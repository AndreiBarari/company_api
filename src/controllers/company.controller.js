const axios = require("axios");
const Company = require("../models/company.model");

// Check time state
const isStale = (dateString, daysValid) => {
  if (!dateString) return true;
  const lastUpdate = new Date(dateString);
  const now = new Date();
  const diffTime = Math.abs(now - lastUpdate);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays > daysValid;
};

// Time Configuration
const TTL_BASIC = 365;
const TTL_DETAILS = 30;

// Search Company
exports.searchCompany = async (req, res) => {
  const searchTerm = req.query.q;

  if (!searchTerm) {
    return res.status(400).json({ error: "Missing query parameter 'q'" });
  }

  try {
    const dbCompanies = await Company.find({
      denumire: { $regex: searchTerm, $options: "i" },
    });

    // Check DB
    const hasData = dbCompanies.length > 0;
    const isFresh = hasData && !isStale(dbCompanies[0].updatedAt, TTL_BASIC);

    if (hasData && isFresh) {
      console.info(`[SEARCH] Cache hit (Fresh) for '${searchTerm}'`);
      return res.json(dbCompanies);
    }

    if (hasData && !isFresh) {
      console.info(
        `[SEARCH] Cache hit but STALE (>1 year). Refreshing '${searchTerm}'...`,
      );
    } else {
      console.info(`[SEARCH] Cache miss. Fetching '${searchTerm}' from API...`);
    }

    // Fetch from API
    const response = await axios.post(
      `https://api.openapi.ro/api/companies/search`,
      { q: searchTerm },
      { headers: { "x-api-key": process.env.USER_KEY } },
    );

    const apiData = response.data;
    const companiesList = Array.isArray(apiData) ? apiData : apiData.data;

    if (companiesList && Array.isArray(companiesList)) {
      const updates = companiesList.map((data) => ({
        updateOne: {
          filter: { _id: String(data.cif) },
          update: {
            $set: {
              denumire: data.denumire,
              judet: data.judet,
              url: data.url,
              cif: String(data.cif),
            },
          },
          upsert: true,
        },
      }));

      if (updates.length > 0) {
        await Company.bulkWrite(updates);
        console.info(`[SEARCH] Cached/Refreshed ${updates.length} companies`);
      }
      res.json(companiesList);
    } else {
      res.json(apiData);
    }
  } catch (error) {
    console.error("[SEARCH] Error:", error.message);
    res.status(500).json({ error: "Error processing search request" });
  }
};

// Company Details
exports.getCompanyDetails = async (req, res) => {
  const cif = req.params.cif;

  try {
    const company = await Company.findById(cif);
    const hasDetails = company && company.adresa;
    const lastUpdate = company?.meta?.updated_at || company?.updatedAt;
    const isFresh = !isStale(lastUpdate, TTL_DETAILS);

    if (hasDetails && isFresh) {
      console.info(`[DETAILS] Serving CIF ${cif} from DB (Fresh)`);
      return res.json(company);
    }

    if (hasDetails && !isFresh) {
      console.info(
        `[DETAILS] CIF ${cif} is STALE (>30 days). Refreshing from API...`,
      );
    } else {
      console.info(
        `[DETAILS] CIF ${cif} missing details. Fetching from API...`,
      );
    }

    // Fetch from API
    const response = await axios.get(
      `https://api.openapi.ro/api/companies/${cif}`,
      { headers: { "x-api-key": process.env.USER_KEY } },
    );

    const data = response.data;

    const updatedCompany = await Company.findByIdAndUpdate(
      cif,
      {
        $set: {
          adresa: data.adresa,
          cod_postal: data.cod_postal,
          telefon: data.telefon,
          fax: data.fax,
          stare: data.stare,
          radiata: data.radiata,
          act_autorizare: data.act_autorizare,
          tva: data.tva,
          tva_la_incasare: data.tva_la_incasare,
          meta: {
            updated_at: new Date(),
            last_changed_at: data.meta?.last_changed_at || null,
          },
          cif: String(data.cif),
          denumire: data.denumire,
          judet: data.judet,
        },
      },
      { new: true, upsert: true },
    );

    console.info(`[DETAILS] Updated and served CIF ${cif}`);
    res.json(updatedCompany);
  } catch (error) {
    const status = error.response?.status || 500;
    console.error(`[DETAILS] Error fetching CIF ${cif}:`, error.message);
    res.status(status).json({
      error: "Error fetching company details",
      details: error.response?.data || error.message,
    });
  }
};

exports.getBalanceSheet = async (req, res) => {
  const cif = req.params.cif;
  const currentYear = new Date().getFullYear();
  const year = parseInt(req.query.year) || currentYear - 1;

  try {
    const company = await Company.findOne({
      _id: cif,
      "bilanturi.year": year,
    });

    let balanceData = null;
    let isFresh = false;

    if (company) {
      balanceData = company.bilanturi.find((b) => b.year === year);
      if (balanceData) {
        isFresh = !isStale(balanceData.meta?.updated_at, TTL_DETAILS);
      }
    }

    if (balanceData && isFresh) {
      console.info(
        `[BALANCE] Serving year ${year} for CIF ${cif} from DB (Fresh)`,
      );
      return res.json(balanceData);
    }

    if (balanceData && !isFresh) {
      console.info(
        `[BALANCE] Year ${year} for CIF ${cif} is STALE (>30 days). Refreshing...`,
      );
    } else {
      console.info(
        `[BALANCE] Fetching year ${year} for CIF ${cif} from API...`,
      );
    }

    const response = await axios.get(
      `https://api.openapi.ro/api/companies/${cif}/balances/${year}`,
      { headers: { "x-api-key": process.env.USER_KEY } },
    );

    const apiData = response.data;

    await Company.findByIdAndUpdate(cif, {
      $pull: { bilanturi: { year: year } },
    });

    const updatedCompany = await Company.findByIdAndUpdate(
      cif,
      {
        $push: {
          bilanturi: {
            year: apiData.year,
            balance_type: apiData.balance_type,
            caen_code: apiData.caen_code,
            meta: {
              updated_at: new Date(),
            },
            data: apiData.data,
          },
        },
      },
      { new: true, upsert: true },
    );

    console.info(`[BALANCE] Saved/Refreshed year ${year} for CIF ${cif}`);
    const newBalance = updatedCompany.bilanturi.find((b) => b.year === year);
    res.json(newBalance);
  } catch (error) {
    if (error.response?.status === 404) {
      console.warn(`[BALANCE] No data found for CIF ${cif} Year ${year}`);
      return res
        .status(404)
        .json({ error: `No financial data available for year ${year}` });
    }
    console.error(`[BALANCE] Error fetching CIF ${cif}:`, error.message);
    res.status(500).json({ error: "Error fetching balance sheet" });
  }
};
