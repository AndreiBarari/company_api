const mongoose = require("mongoose");

const CompanySchema = new mongoose.Schema(
  {
    _id: { type: String, required: true },

    denumire: { type: String, index: true },
    judet: String,
    url: String,
    cif: String,

    adresa: String,
    cod_postal: String,
    telefon: String,
    fax: String,
    stare: String,
    radiata: Boolean,
    act_autorizare: String,
    accize: String,
    impozit_micro: Boolean,
    impozit_profit: Boolean,
    numar_reg_com: String,
    tva: String,
    tva_la_incasare: [String],
    ultima_declaratie: String,
    ultima_prelucrare: String,

    meta: {
      updated_at: Date,
      last_changed_at: Date,
    },

    bilanturi: [
      {
        year: Number,
        balance_type: String,
        caen_code: String,
        meta: {
          updated_at: Date,
        },
        data: {
          active_circulante_total: Number,
          active_imobilizate_total: Number,
          caen_descriere: String,
          capitaluri_capital: Number,
          capitaluri_patrimoniul_regiei: Number,
          capitaluri_total: Number,
          casa_si_conturi: Number,
          cheltuieli_in_avans: Number,
          cheltuieli_totale: Number,
          cifra_de_afaceri_neta: Number,
          creante: Number,
          datorii_total: Number,
          numar_mediu_de_salariati: Number,
          pierdere_bruta: Number,
          pierdere_neta: Number,
          profit_brut: Number,
          profit_net: Number,
          provizioane: Number,
          stocuri: Number,
          venituri_in_avans: Number,
          venituri_totale: Number,
        },
      },
    ],
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model("Company", CompanySchema);
