<?php
namespace App\Http\Controllers;

use App\Models\StoreData;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class FetchProductsController extends Controller
{
    protected $storeData;

    public function __construct()
    {
        $this->storeData = new StoreData();
    }

    public function getProducts(Request $request)
    {
        /** @var AuthSession */
        $session = $request->get('shopifySession');
        $shop = DB::table('shops')->where('store', $session->getShop())->first();

        $pageInfo = $request->input('page_info', null);
        $shopUrl = $shop->store;
        $pageSize = $request->input('page_size');
        $query = $request->input('query', '');
        $isPrevious = $request->input('is_previous', false);

        try {
            $accessToken = $this->storeData->getSessionData($shopUrl);
            // Log::info("AccessToken in Controller: $accessToken");

            $data = $this->storeData->fetchProducts($pageInfo, $accessToken, $shopUrl, $pageSize, $query, $isPrevious);

            return response()->json($data);
        } catch (\Exception $e) {
            return response()->json(['error' => $e->getMessage()], 500);
        }
    }

}
