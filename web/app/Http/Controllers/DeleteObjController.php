<?php

namespace App\Http\Controllers;

use App\Models\StoreData;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class DeleteObjController extends Controller
{
    protected $storeData;

    public function __construct(StoreData $storeData)
    {
        $this->storeData = $storeData;
    }

    public function DeleteMetaObj(Request $request)
    {
        $handle = $request->input('handle');
        $type = $request->input('type');

        /** @var AuthSession */
        $session = $request->get('shopifySession');
        $shop = DB::table('shops')->where('store', $session->getShop())->first();

        if (!$shop) {
            return response()->json([
                'success' => false,
                'message' => 'Shop not found',
            ], 404);
        }

        $shopUrl = $shop->store;
        $apiVersion = "2024-07";
        $endpoint = "https://$shopUrl/admin/api/$apiVersion/graphql.json";

        // Corrected GraphQL query
        $fetchIdQuery = <<<GRAPHQL
        {
            metaobjectByHandle(
                handle: {type: "$type", handle: "$handle"}
            ) {
                id
            }
        }
        GRAPHQL;
        Log::info("$fetchIdQuery");

        try {
            $idResponse = $this->storeData->makeGraphQLRequest($fetchIdQuery, $session->getAccessToken(), $endpoint);
            Log::info("ID Response: " . json_encode($idResponse));

            $metaobjectId = $idResponse['data']['metaobjectByHandle']['id'] ?? null;
            Log::info("metaobjectId::  $metaobjectId");
            if (!$metaobjectId) {
                return response()->json([
                    'success' => false,
                    'message' => 'Metaobject not found. Please save existing content before delete.',
                ], 404);
            }

            // GraphQL query to delete the metaobject
            $deleteQuery = <<<GRAPHQL
            mutation {
                metaobjectDelete(id: "$metaobjectId") {
                    deletedId
                    userErrors {
                    field
                    message
                    code
                    }
                }
            }
            GRAPHQL;
            Log::info("$deleteQuery");
            $deleteResponse = $this->storeData->makeGraphQLRequest($deleteQuery, $session->getAccessToken(), $endpoint);
            Log::info("Delete Response: " . json_encode($deleteResponse));

            return response()->json([
                'success' => true,
                'message' => 'Metaobject deleted successfully.',
            ]);

        } catch (\Exception $e) {
            Log::error("Error: " . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'An error occurred',
            ], 500);
        }
    }
}
