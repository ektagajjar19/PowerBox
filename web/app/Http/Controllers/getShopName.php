<?php

namespace App\Http\Controllers;

use App\Models\StoreData;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Shopify\Auth\Session as AuthSession;
use Illuminate\Support\Facades\Validator;

class getShopName extends Controller
{
    protected $storeName;

    public function __construct()
    {
        $this->storeName = StoreData::getStoreName(Session::instance());
    }
    public function index(Request $request)
    {
        return $this->storeName;
    }
}
