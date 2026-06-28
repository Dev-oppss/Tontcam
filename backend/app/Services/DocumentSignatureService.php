<?php

namespace App\Services;

class DocumentSignatureService
{
    public function sign(string $path, array $context = []): string
    {
        $hash = hash_file('sha256', $path);
        $secret = config('app.key') ?: 'tontineapp';
        if (str_starts_with($secret, 'base64:')) {
            $secret = base64_decode(substr($secret, 7), true) ?: $secret;
        }
        $payload = [
            'file' => basename($path),
            'sha256' => $hash,
            'context' => $context,
            'signed_at' => now()->toIso8601String(),
        ];
        $payload['signature'] = hash_hmac('sha256', json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE), $secret);
        $sigPath = $path . '.sig.json';
        file_put_contents($sigPath, json_encode($payload, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE));
        return $sigPath;
    }
}
