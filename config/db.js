const mysql = require("mysql2");

const db = mysql.createConnection({
  host: "77.37.48.35",
  user: "u498357097_invoicemaker",
  password: "ayVILQzR05O^",
  database: "u498357097_invoicemaker",
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