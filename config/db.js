const mysql = require("mysql2");

/*const db = mysql.createConnection({
  host: "dev-zilla.com",
  user: "u498357097_invoicemaker",
  password: "ayVILQzR05O^",
  database: "u498357097_invoicemaker",
  port: 3306
});*/
const db = mysql.createConnection({
  host: "72.167.52.232",
  user: "invoiceuser",
  password: "invoice@123",
  database: "odgtv1_invoice",
  port: 3306
});

db.connect((err) => {
  if (err) {
    console.log("Database connection failed", err);
  } else {
    console.log("MySQL Connected");
  }
});

module.exports = db;