const express = require("express");
const router = express.Router();
const companyController = require("../controllers/company.controller");

router.get("/search", companyController.searchCompany);

router.get("/company/:cif", companyController.getCompanyDetails);

router.get("/company/:cif/balance", companyController.getBalanceSheet);

module.exports = router;
