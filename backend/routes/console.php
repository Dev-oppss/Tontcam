<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;
use App\Models\Association;
use App\Services\RapprochementService;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Schedule::call(function () {
    $service = app(RapprochementService::class);
    Association::query()->pluck('id')->each(fn ($id) => $service->notifierEcartsEnRetard($id));
})->dailyAt('08:00')->name('alertes-ecarts-rapprochement')->withoutOverlapping();
