<?php

namespace App\Http\Controllers;

use App\Models\StoreData;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class UpsertMetaObjController extends Controller
{
    protected $storeData;

    public function __construct()
    {
        $this->storeData = new StoreData();
    }

    public function upsertMetaObj(Request $request)
    {
        $pId = $request->input('pId');
        $type = $request->input('type');
        $handles = $request->input('handles', []);
        $fields = $request->input('fields', []);
        $metafieldkey = $fields[0]['metafieldkey'];
        $specMetaFields = [];
        $selectionMetaFields = [];

        /** @var AuthSession */
        $session = $request->get('shopifySession');
        $shop = DB::table('shops')->where('store', $session->getShop())->first();

        $shopUrl = $shop->store;
        $apiVersion = "2024-07";
        $endpoint = "https://$shopUrl/admin/api/$apiVersion/graphql.json";

        // GraphQL query for metaobject upsert
        $upsertQuery = '
        mutation UpsertMetaobject($handle: MetaobjectHandleInput!, $metaobject: MetaobjectUpsertInput!) {
            metaobjectUpsert(handle: $handle, metaobject: $metaobject) {
                metaobject {
                    handle
                    id
                    capabilities {
                        publishable {
                            status
                        }
                    }
                }
                userErrors {
                    field
                    message
                    code
                }
            }
        }';

        // GraphQL query for setting metafields
        $setMetafieldsQuery = '
        mutation MetafieldsSet($metafields: [MetafieldsSetInput!]!) {
            metafieldsSet(metafields: $metafields) {
                metafields {
                    key
                    namespace
                    value
                    createdAt
                    updatedAt
                }
                userErrors {
                    field
                    message
                    code
                }
            }
        }';

        // GraphQL query for deleting metafields
        $deleteMetafieldsQuery = '
        mutation MetafieldsDelete($metafields: [MetafieldIdentifierInput!]!) {
            metafieldsDelete(metafields: $metafields) {
                deletedMetafields {
                    key
                    namespace
                    ownerId
                }
                userErrors {
                    field
                    message
                }
            }
        }';

        foreach ($handles as $index => $handle) {
            $key = $fields[$index]['key'];
            $value = $fields[$index]['value'];

            // Handle the case where value is blank and run delete mutation instead
            if (empty($value)) {
                $deleteVariables = [
                    'metafields' => [
                        [
                            'key' => $metafieldkey,
                            'namespace' => 'custom',
                            'ownerId' => $pId
                        ]
                    ]
                ];

                $deleteResponse = $this->storeData->makeGraphQLRequest($deleteMetafieldsQuery, $session->getAccessToken(), $endpoint, $deleteVariables);
                if (isset($deleteResponse['data']['metafieldsDelete']['userErrors']) && count($deleteResponse['data']['metafieldsDelete']['userErrors']) > 0) {
                    return response()->json([
                        'success' => false,
                        'errors' => $deleteResponse['data']['metafieldsDelete']['userErrors']
                    ], 400);
                }

                Log::info("Metafields Deleted Response:: " . json_encode($deleteResponse));
                continue;
            }

            $upsertVariables = [
                'handle' => [
                    'type' => $type,
                    'handle' => $handle
                ],
                'metaobject' => [
                    'fields' => [
                        [
                            'key' => $key,
                            'value' => $value
                        ]
                    ],
                    'capabilities' => [
                        'publishable' => [
                            'status' => 'ACTIVE'
                        ]
                    ]
                ]
            ];

            $upsertResponse = $this->storeData->makeGraphQLRequest($upsertQuery, $session->getAccessToken(), $endpoint, $upsertVariables);
            if (isset($upsertResponse['data']['metaobjectUpsert']['userErrors']) && count($upsertResponse['data']['metaobjectUpsert']['userErrors']) > 0) {
                return response()->json([
                    'success' => false,
                    'errors' => $upsertResponse['data']['metaobjectUpsert']['userErrors']
                ], 400);
            }

            Log::info("Upsert Response:: " . json_encode($upsertResponse));
            $metaobjId = $upsertResponse['data']['metaobjectUpsert']['metaobject']['id'];

            // Categorize metaobject IDs based on the key
            if ($key === 'spec') {
                $specMetaFields[] = $metaobjId;
            }
            elseif ($key === 'selection') {
                $selectionMetaFields[] = $metaobjId;
            }
        }

        // Prepare metafields variables based on the type
        $metaFieldsToSet = ($type === 'selections') ? $selectionMetaFields : $specMetaFields;
        Log::info("Metafields to set". json_encode($metaFieldsToSet));

        // Only proceed if there are metaobject IDs to set
        if (!empty($metaFieldsToSet)) {
            $metafieldsVariables = [
                'metafields' => [
                    [
                        'ownerId' => $pId,
                        'namespace' => 'custom', // Static
                        'key' => $metafieldkey, // 'spec' or 'selections'
                        'value' => json_encode($metaFieldsToSet), // Convert array to JSON string
                        'type' => 'list.metaobject_reference' // Static
                    ]
                ]
            ];
            Log::info("Metafields Variables". json_encode($metafieldsVariables));
            $metafieldsResponse = $this->storeData->makeGraphQLRequest($setMetafieldsQuery, $session->getAccessToken(), $endpoint, $metafieldsVariables);

            if (isset($metafieldsResponse['data']['metafieldsSet']['userErrors']) && count($metafieldsResponse['data']['metafieldsSet']['userErrors']) > 0) {
                return response()->json([
                    'success' => false,
                    'errors' => $metafieldsResponse['data']['metafieldsSet']['userErrors']
                ], 400);
            }

            Log::info("Metafields Response:: " . json_encode($metafieldsResponse));
        }

        // Success response
        return response()->json([
            'success' => true,
            'message' => !empty($specMetaFields) || !empty($selectionMetaFields) ? 'MetaObjects processed successfully' : 'MetaObjects deleted successfully',
            'specMetaFields' => $specMetaFields,
            'selectionMetaFields' => $selectionMetaFields,
        ]);
    }
}
