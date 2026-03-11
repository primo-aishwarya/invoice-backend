const express = require("express");
const cors = require("cors");
const db = require("./config/db");
// const db = require("./db");
const app = express();
const { v4: uuidv4 } = require("uuid");

let invoices = {};
// app.use(cors());
const allowedOrigins = [
  'http://localhost:5173',
  'https://dev-zilla.com',
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ["GET","POST","PUT","DELETE","PATCH"],
  allowedHeaders: ["Content-Type","Authorization","ngrok-skip-browser-warning"]
}));
app.use(express.json());

app.get("/", (req, res) => {
  res.send("Invoice API Running");
});
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});

app.post("/api/invoices", async (req, res) => {

 try {

    const data = req.body;

    // 1️⃣ Items empty check
    if (!data.items || data.items.length === 0) {
      return res.status(400).json({
        message: "Invoice must contain at least one item"
      });
    }

    // 2️⃣ Duplicate invoice number check
    const [checkInvoice] = await db.promise().query(
      "SELECT id FROM invoice WHERE invoice_number = ?",
      [data.Invoice_number]
    );

    if (checkInvoice.length > 0) {
      return res.status(400).json({
        message: "Invoice number already exists"
      });
    }

    const invoiceQuery = `
    INSERT INTO invoice
    (invoice_number,purchase_order,freelancer, email, website_link, company_country,
    company_address, company_city, company_postal, company_state,
    client_business, client_email, client_phone, client_country,
    client_address, client_city, client_state, date, total_amount,tax,discount,shipping_fee,due_date,account_detail,payment_terms)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`;

    const invoiceValues = [
        data.Invoice_number,
        data.Purchase_order,
        data.Freelancer,
        data.email,
        data.Website_link,
        data.CompanyCountry,
        data.Company_address,
        data.Company_city,
        data.Company_postal,
        data.Company_state,
        data.Client_business,
        data.Client_email,
        data.Client_phone,
        data.ClientCountry,
        data.Client_address,
        data.Client_city,
        data.Client_state,
        data.Invoice_date,
        data.totalAmount,
        data.GST,
        data.Discount,
        data.Shipping,
        data.Due_date,
        data.Account_detail,
        data.Payment_terms
    ];

    const [result] = await db.promise().query(invoiceQuery, invoiceValues);

    const invoiceId = result.insertId;

    // 3️⃣ Insert products
    for (let item of data.items) {

      const itemQuery = `
      INSERT INTO products
      (invoice, description, unit_cost, quantity, amount)
      VALUES (?,?,?,?,?)`;

      await db.promise().query(itemQuery, [
        invoiceId,
        item.description,
        item.cost,
        item.quantity,
        item.amount
      ]);
    }
    const baseUrl = req.protocol + "://" + req.get("host");

    res.json({
      status: "success",
      invoice_id: invoiceId,
      view_url: `${baseUrl}/api/get_invoice/${invoiceId}`
    });
   /* res.json({
      status: "success",
      invoice_id: invoiceId,
      view_url: `https://laurene-cracked-sterling.ngrok-free.dev/api/get_invoice/${invoiceId}`
    });
*/
 } catch (error) {

    console.log(error);

    res.status(500).json({
      message: error.message
    });

 }

});

app.get("/api/get_invoice/:id", (req, res) => {

  const id = req.params.id;

  const invoiceSql = "SELECT * FROM invoice WHERE id = ?";
  const productSql = "SELECT * FROM products WHERE invoice = ?";

  db.query(invoiceSql, [id], (err, invoiceResult) => {

    if (err) {
      return res.status(500).json(err);
    }

    if (invoiceResult.length === 0) {
      return res.status(404).json({
        message: "Invoice not found"
      });
    }

    const invoice = invoiceResult[0];

    db.query(productSql, [id], (err, productResult) => {

      if (err) {
        return res.status(500).json(err);
      }

      invoice.items = productResult;

      res.json(invoice);

    });

  });

});

app.get("/api/countries", (req, res) => {

  const id = req.params.id;

  const sql = "SELECT country_name,id FROM countries";

  db.query(sql, (err, result) => {

    if (err) {
      return res.status(500).json(err);
    }

    if (result.length === 0) {
      return res.status(404).json({
        message: "Country not found"
      });
    }

    res.json(result);
  });
});