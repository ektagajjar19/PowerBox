<?php

namespace App\Models;

use GuzzleHttp\Client;
use Shopify\Auth\Session;
use Shopify\Clients\Graphql;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class StoreData extends Model
{
    public $_access_token;

    public function __construct()
    {
        $this->_access_token = '';
    }
    use HasFactory;
    public static function getStoreData(Session $session)
    {
         /** @var AuthSession */
         Log::info("ShopName in getStoreData::". trim($session->getShop()));
        $tblExist = DB::table('shops')->where('store', trim($session->getShop()))->first();
        if ($tblExist) {
            $array = [
                'access_token' => trim($session->getAccessToken()),
                'updated_at' => now()
            ];
            DB::table('shops')->where('id', $tblExist->id)->update($array);
        } else {
            $array = [
                'store' => trim($session->getShop()),
                'access_token' => trim($session->getAccessToken()),
                'created_at' => now()
            ];
            DB::table('shops')->insert($array);
            return $array;
        }
    }

    public function getSessionData($shop)
    {
        $_sessionData = DB::table('shops')->where('store', $shop)->first();
        if ($_sessionData) {
            $this->_access_token = $_sessionData->access_token;
        }
        return $_sessionData->access_token;
    }

    public function fetchProducts($pageInfo = null, $accessToken, $shopUrl, $pageSize = 25, $query = '', $isPrevious = false)
    {
        // Determine the correct cursor direction
        $paginationKeyword = $isPrevious ? "last" : "first";
        $cursorDirection = $isPrevious ? "before" : "after";
        $cursorClause = is_null($pageInfo) ? "" : ", $cursorDirection: \"$pageInfo\"";
        $searchQuery = $query ? ", query: \"$query\"" : "";

        if (!$accessToken) {
            throw new \Exception("Access Token is missing.");
        }

        $client = new Graphql($shopUrl, $accessToken);

        $query = <<<GRAPHQL
        {
            products($paginationKeyword: $pageSize $cursorClause $searchQuery) {
                edges {
                    node {
                        id
                        title
                        status
                        featuredMedia {
                            preview {
                                image {
                                url
                                }
                            }
                        }
                    }
                }
                pageInfo {
                    hasNextPage
                    hasPreviousPage
                    startCursor
                    endCursor
                }
            }
        }
        GRAPHQL;

        // Log::info("GraphQL Query for products: $query");
        $response = $client->query($query);
        // Log::info('GraphQL Response: ', ['responseBody' => $response]);

        $responseBody = $response->getDecodedBody();
        if (isset($responseBody['errors'])) {
            throw new \Exception("Error fetching products: " . json_encode($responseBody['errors']));
        }

        return [
            'products' => array_map(function ($product) {
                return [
                    'id' => $product['node']['id'],
                    'title' => $product['node']['title'],
                    'status' => $product['node']['status'],
                    // 'imgUrl' => $product['node']['featuredMedia']['preview']['image']['url'] ?? null,
                ];
            }, $responseBody['data']['products']['edges']),
            'next_page_info' => $responseBody['data']['products']['pageInfo']['endCursor'] ?? null,
            'prev_page_info' => $responseBody['data']['products']['pageInfo']['startCursor'] ?? null,
            'has_next_page' => $responseBody['data']['products']['pageInfo']['hasNextPage'],
            'has_prev_page' => $responseBody['data']['products']['pageInfo']['hasPreviousPage'],
        ];
    }

    public function makeGraphQLRequest($query, $accessToken, $endpoint, $variables = ["key"=>"value"])
    {
        $client = new Client();
        //Log::info('GraphQL Request Payload:', [
        //     'query' => $query,
        //     'variables' => $variables,
        // ]);
        $response = $client->post($endpoint, [
            'headers' => [
                'X-Shopify-Access-Token' => $accessToken,
                'Content-Type' => 'application/json',
            ],
            'json' => [
                'query' => $query,
                'variables' => $variables,  // Ensure this is passed correctly as an associative array
            ],
        ]);
        return json_decode($response->getBody()->getContents(), true);
    }

}
