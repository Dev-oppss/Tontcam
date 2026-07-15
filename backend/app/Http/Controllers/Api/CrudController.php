<?php

namespace App\Http\Controllers\Api;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;

abstract class CrudController extends Controller
{
    protected string $model;

    public function index(Request $request): JsonResponse
    {
        return response()->json($this->query($request)->paginate($request->integer('per_page', 25)));
    }

    public function store(Request $request): JsonResponse
    {
        $item = $this->model::create($request->all());
        return response()->json($item, 201);
    }

    public function show(Request $request, string $id): JsonResponse
    {
        return response()->json($this->query($request)->findOrFail($id));
    }

    public function update(Request $request, string $id): JsonResponse
    {
        $item = $this->query($request)->findOrFail($id);
        $item->fill($request->all())->save();
        return response()->json($item);
    }

    public function destroy(Request $request, string $id): JsonResponse
    {
        $this->query($request)->findOrFail($id)->delete();
        return response()->json(['deleted' => true]);
    }

    protected function query(Request $request)
    {
        /** @var Model $model */
        $model = new $this->model;
        $query = $model->newQuery();
        return $query;
    }
}
