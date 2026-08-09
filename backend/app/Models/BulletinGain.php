<?php

namespace App\Models;

use App\Models\Concerns\UsesUuid;
use Illuminate\Database\Eloquent\Model;

class BulletinGain extends Model
{
    use UsesUuid;

    protected $table = 'bulletins_gain';

    protected $fillable = [
        'cycle_id',
        'gagnant_membre_id',
        'gagnant_part_id',
        'numero_bulletin',
        'montant_brut',
        'total_retenues',
        'montant_net',
        'statut',
        'mode_versement',
        'reference_versement',
        'date_versement',
        'signe_tresorier_at',
        'signe_president_at',
        'signe_beneficiaire_at',
        'pdf_url',
        'genere_par',
    ];

    protected $casts = [
            'montant_brut' => 'decimal:2',
            'total_retenues' => 'decimal:2',
            'montant_net' => 'decimal:2',
            'date_versement' => 'datetime',
            'signe_tresorier_at' => 'datetime',
            'signe_president_at' => 'datetime',
            'signe_beneficiaire_at' => 'datetime'
    ];

    public function cycle()
    {
        return $this->belongsTo(CycleTontine::class, 'cycle_id');
    }


    public function gagnant()
    {
        return $this->belongsTo(Membre::class, 'gagnant_membre_id');
    }


    public function part()
    {
        return $this->belongsTo(TontinePart::class, 'gagnant_part_id');
    }


    public function retenues()
    {
        return $this->hasMany(RetenueBulletin::class, 'bulletin_id');
    }


    public function generateur()
    {
        return $this->belongsTo(Utilisateur::class, 'genere_par');
    }

    /**
     * RG-RPT-008 : hash SHA-256 d'intégrité, calculable uniquement une fois les 3
     * signatures réunies. Toute altération a posteriori du montant, du bénéficiaire
     * ou des horodatages de signature change ce hash — c'est la preuve de signature
     * numérique (aucune clé privée n'étant disponible côté serveur, l'intégrité
     * scellée + l'horodatage tiennent lieu de signature).
     */
    public function getHashIntegriteAttribute(): ?string
    {
        if (! ($this->signe_tresorier_at && $this->signe_president_at && $this->signe_beneficiaire_at)) {
            return null;
        }

        return hash('sha256', implode('|', [
            $this->numero_bulletin,
            $this->gagnant_membre_id,
            $this->montant_net,
            $this->signe_tresorier_at->toIso8601String(),
            $this->signe_president_at->toIso8601String(),
            $this->signe_beneficiaire_at->toIso8601String(),
        ]));
    }

}
