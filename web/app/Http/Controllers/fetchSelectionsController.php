<?php

namespace App\Http\Controllers;

use App\Models\StoreData;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class fetchSelectionsController extends Controller
{
    protected $storeData;
    public function __construct()
    {
        $this->storeData = new StoreData();
    }

    public function fetchSelections(Request $request)
    {
        /** @var AuthSession */
        $session = $request->get('shopifySession');
        $shop = DB::table('shops')->where('store', $session->getShop())->first();

        // Log::info("Selection Request: $request");
        $productId = $request->input('productId');
        $shopUrl = $shop->store;
        $apiVersion = "2024-07";
        $endpoint = "https://$shopUrl/admin/api/$apiVersion/graphql.json";

        // GraphQL query to fetch product metafields
        $query = '
        query FetchProductMetaobjects($productId: ID!) {
            product(id: $productId) {
                metafields(first: 100) {
                    edges {
                        node {
                            id
                            namespace
                            key
                            value
                        }
                    }
                }
            }
        }';
        // Log::info("selection Query :: $query");
        try {
            $accessToken = $this->storeData->getSessionData($shopUrl);
            $variables = ['productId' => $productId];
            $response = $this->storeData->makeGraphQLRequest($query, $accessToken, $endpoint, $variables);
            $metafields = $response['data']['product']['metafields']['edges'] ?? [];
            $specTables = [];

            foreach ($metafields as $metafield) {
                $metaobjectIds = json_decode($metafield['node']['value'], true);

                if (is_array($metaobjectIds)) {
                    foreach ($metaobjectIds as $metaobjectId) {
                        $metaobjectQuery = '
                            {
                                metaobject(id: "'.$metaobjectId.'") {
                                    id
                                    type
                                    handle
                                    fields {
                                        key
                                        value
                                    }
                                }
                            }';
                        // Log::info("Selection metaobject fetch Query: $metaobjectQuery");
                        $metaobjectResponse = $this->storeData->makeGraphQLRequest($metaobjectQuery, $accessToken, $endpoint);

                        if (isset($metaobjectResponse['data']['metaobject']) &&
                            $metaobjectResponse['data']['metaobject']['type'] === 'selections') {
                            $specTables[] = $metaobjectResponse['data']['metaobject'];
                        }
                    }
                }
            }
            //Log::info(response()->json($specTables));
            return response()->json($specTables);
        } catch (\Exception $e) {
            return response()->json(['error' => $e->getMessage()], 500);
        }
    }
}
