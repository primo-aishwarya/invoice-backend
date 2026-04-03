const express = require("express");
const cors = require("cors");
const db = require("./config/db");
const app = express();
const crypto = require("crypto");
const { v4: uuidv4 } = require("uuid");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const transporter = require("./config/mail");

const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
  'https://dev-zilla.com',
];

const optionalAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    req.user = null;
    return next();
  }

  try {
    let token;

    if (authHeader.startsWith("Bearer ")) {
      token = authHeader.split(" ")[1]; // Bearer token
    } else {
      token = authHeader; // direct token (old method)
    }

    const decoded = jwt.verify(token, "SECRET_KEY");
    req.user = decoded;

  } catch (err) {
    console.log("JWT ERROR:", err.message);
    req.user = null;
  }

  next();
};

const authMiddleware = (req, res, next) => {
  const token = req.headers.authorization;

  if (!token) {
    return res.status(401).json({ message: "Token missing" });
  }

  try {
    const decoded = jwt.verify(token, "SECRET_KEY");
    req.user = decoded; // user id 
    next();
  } catch (err) {
    return res.status(401).json({ message: "Invalid token" });
  }
};

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
  allowedHeaders: ["Content-Type","Authorization","x-invoice-password","ngrok-skip-browser-warning"]
}));

app.use(express.json());

app.get("/", (req, res) => {
  res.send("Invoice API Running");
});

app.listen(5000, () => {
  console.log("Server running on port 5000");
});
/*=====================login=====================*/

app.post("/api/login", async (req, res) => {
  const { email, password } = req.body;

  const [user] = await db.promise().query(
    "SELECT * FROM users WHERE email = ?",
    [email]
  );

  if (user.length === 0) {
    return res.status(404).json({ message: "User not found" });
  }

  const bcrypt = require("bcrypt");
  const match = await bcrypt.compare(password, user[0].password);

  if (!match) {
    return res.status(401).json({ message: "Invalid password" });
  }

  const token = jwt.sign(
    { id: user[0].user_id, email: user[0].email },
    "SECRET_KEY",
    { expiresIn: "7d" }
  );

  res.json({
    token,
    user: user[0]
  });
});

/*========================registration=================*/

app.post("/api/register", async (req, res) => {
  try {
    const { fullname, email, phone, password, cpassword } = req.body;

    if (!fullname || !email || !password || !cpassword) {
      return res.status(400).json({
        message: "All fields are required"
      });
    }

    if (password !== cpassword) {
      return res.status(400).json({
        message: "Password and Confirm Password do not match"
      });
    }

    const [existingUser] = await db.promise().query(
      "SELECT user_id FROM users WHERE email = ?",
      [email]
    );

    if (existingUser.length > 0) {
      return res.status(400).json({
        message: "Email already registered"
      });
    }

    const bcrypt = require("bcrypt");
    const hashedPassword = await bcrypt.hash(password, 10);

    const [result] = await db.promise().query(
      "INSERT INTO users (fullname, email, phone, password) VALUES (?,?,?,?)",
      [fullname, email, phone, hashedPassword]
    );

    res.json({
      status: "success",
      message: "User registered successfully",
      user_id: result.insertId
    });

  } catch (error) {
    console.log(error);
    res.status(500).json({ message: error.message });
  }
});
// ===============

const senderTemplate = (data, publicUrl) => {
  return `
  <div style="font-family: Arial; background:#f4f6f8; padding:20px;">
    <div style="max-width:600px; margin:auto; background:#fff; padding:25px; border-radius:8px;">
      
      <h2 style="color:#2c3e50;">Invoice Sent Successfully </h2>
      
      <p>Hello <b>${data.Freelancer || "User"}</b>,</p>
      
      <p>Your invoice <b>#${data.Invoice_number}</b> has been successfully sent to <b>${data.Client_email}</b>.</p>
      
      <p>You can view the invoice anytime using the link below:</p>
      
      <a href="${publicUrl}" style="display:inline-block; padding:10px 20px; background:#3498db; color:#fff; text-decoration:none; border-radius:5px;">
        View Invoice
      </a>

      <p style="margin-top:20px;">Thank you for using our platform.</p>
      
      <hr>
      <small>Invoice System</small>
    </div>
  </div>
  `;
};

const receiverTemplate = (data, publicUrl, password) => {
  return `
  <div style="font-family: Arial; background:#f4f6f8; padding:20px;">
    <div style="max-width:600px; margin:auto; background:#fff; padding:25px; border-radius:8px;">
      
      <h2 style="color:#2c3e50;">New Invoice Received </h2>
      
      <p>Hello,</p>
      
      <p>You have received a new invoice from <b>${data.Freelancer}</b>.</p>
      
      <p><b>Invoice No:</b> ${data.Invoice_number}</p>
      <p><b>Amount:</b> ₹${data.totalAmount}</p>

      <p>You can view your invoice using the link below:</p>

      <a href="${publicUrl}" style="display:inline-block; padding:10px 20px; background:#27ae60; color:#fff; text-decoration:none; border-radius:5px;">
        View Invoice
      </a>

      <p style="margin-top:15px;">
        <b>Password:</b> ${password}
      </p>

      <p style="margin-top:20px;">Please review and process it.</p>
      
      <hr>
      <small>Invoice System</small>
    </div>
  </div>
  `;
};

// ================= CREATE INVOICE =================
app.post("/api/invoices",optionalAuth, async (req, res) => {
 try {
    const data = req.body;
    const userId = req.user ? req.user.id : null;

    if (!data.items || data.items.length === 0) {
      return res.status(400).json({
        message: "Invoice must contain at least one item"
      });
    }

    const [checkInvoice] = await db.promise().query(
      "SELECT id FROM invoice WHERE invoice_number = ?",
      [data.Invoice_number]
    );

    if (checkInvoice.length > 0) {
      return res.status(400).json({
        message: "Invoice number already exists"
      });
    }

    const password = crypto.randomBytes(6).toString("hex");
    const publicToken = uuidv4();

    const [result] = await db.promise().query(
      `INSERT INTO invoice
      (invoice_number,user_id,purchase_order,freelancer,email,website_link,company_country,
      company_address,company_city,company_postal,company_state,
      client_business,client_email,client_phone,client_country,
      client_address,client_city,client_state,date,total_amount,tax,discount,
      shipping_fee,due_date,account_detail,payment_terms,client_postal,password,public_token)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        data.Invoice_number,
        userId,
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
        data.Payment_terms,
        data.Client_postal,
        password,
        publicToken
      ]
    );

    const invoiceId = result.insertId;
    if(userId!=null)
    {
        const [history] = await db.promise().query(
      `INSERT INTO history(user_id,invoice_id,type_of_history)
      VALUES (?,?,?)`,[userId,result.insertId,'invoice created']);
    }
    

    // insert products
    for (let item of data.items) {
      await db.promise().query(
        `INSERT INTO products (invoice, description, unit_cost, quantity, amount)
         VALUES (?,?,?,?,?)`,
        [
          invoiceId,
          item.description,
          item.cost,
          item.quantity,
          item.amount
        ]
      );
    }

    const baseUrl = req.protocol + "://" + req.get("host");
    const publicUrl = `${baseUrl}/invoicedetail/${publicToken}`;

    try {
      const senderMail = await transporter.sendMail({
        from: '"Invoice App" <primo.aishwaryabairagi@gmail.com>',
        to: data.email,
        subject: "Invoice Sent Successfully",
        html: senderTemplate(data, publicUrl)
      });

      console.log("Sender mail sent:", senderMail.response);

    } catch (err) {
      console.log("Sender mail error:", err);
    }
    try {
      // Send mail to receiver
      const receiverMail = await transporter.sendMail({
        from: '"Invoice App" <primo.aishwaryabairagi@gmail.com>',
        to: data.Client_email,
        subject: "You Received a New Invoice",
        html: receiverTemplate(data, publicUrl, password)
      });
      console.log("Sender mail sent:", senderMail.response);

    } catch (err) {
      console.log("Sender mail error:", err);
    }

    res.json({
      status: "success",
      invoice_id: invoiceId,
      password: password,
      view_url: `${baseUrl}/api/get_invoice/${invoiceId}`,
      public_url: `${baseUrl}/invoicedetail/${publicToken}`,
    });

 } catch (error) {
    console.log(error);
    res.status(500).json({ message: error.message });
 }
});


// ================= PUBLIC INVOICE =================
app.get("/api/invoicedetail/:token", async (req, res) => {
  try {
    const token = req.params.token;
    const password = req.headers["x-invoice-password"];

    if (!password) {
      return res.status(400).json({ message: "Password required" });
    }

    const [invoiceResult] = await db.promise().query(
      "SELECT * FROM invoice WHERE public_token = ? AND password = ?",
      [token, password]
    );

    if (invoiceResult.length === 0) {
      return res.status(403).json({
        message: "Invalid password or link"
      });
    }

    const invoice = invoiceResult[0];
    const invoiceId = invoice.id;

    const [products] = await db.promise().query(
      "SELECT * FROM products WHERE invoice = ?",
      [invoiceId]
    );

    /*res.json({
      invoice: invoice[0],
      items: products
    });
*/
    const baseUrl = req.protocol + "://" + req.get("host");

    invoice.items = products;
    invoice.publicUrl = `${baseUrl}/invoicedetail/${invoice.public_token}`;
    invoice.publicToken = invoice.public_token;

    res.json(invoice);
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: error.message });
  }
});


// ================= GET INVOICE =================
app.get("/api/get_invoice/:id", async (req, res) => {
  try {
    const id = req.params.id;

    const [invoiceResult] = await db.promise().query(
      "SELECT * FROM invoice WHERE id = ?",
      [id]
    );

    if (invoiceResult.length === 0) {
      return res.status(404).json({
        message: "Invoice not found"
      });
    }

    const [productResult] = await db.promise().query(
      "SELECT * FROM products WHERE invoice = ?",
      [id]
    );

    const invoice = invoiceResult[0];

    const baseUrl = req.protocol + "://" + req.get("host");

    invoice.items = productResult;
    invoice.publicUrl = `${baseUrl}/invoicedetail/${invoice.public_token}`;
    invoice.publicToken = invoice.public_token;

    res.json(invoice);

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
});


// ================= COUNTRIES =================
app.get("/api/countries", async (req, res) => {
  try {
    const [result] = await db.promise().query(
      "SELECT country_name,id FROM countries"
    );

    if (result.length === 0) {
      return res.status(404).json({
        message: "Country not found"
      });
    }

    res.json(result);

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
});

/*=============update invoice==================*/

app.put("/api/update_invoices/:id",optionalAuth, async (req, res) => {

  try {

    const invoiceId = req.params.id;
    const data = req.body;
    // const userId = req.user.id;
    const userId = req.user ? req.user.id : null;

    if (!data.items || data.items.length === 0) {
      return res.status(400).json({
        message: "Invoice must contain at least one item"
      });
    }

    // Check invoice exists
    const [check] = await db.promise().query(
      "SELECT id FROM invoice WHERE id = ?",
      [invoiceId]
    );

    if (check.length === 0) {
      return res.status(404).json({
        message: "Invoice not found"
      });
    }

    const [existing] = await db.promise().query(
      "SELECT id FROM invoice WHERE invoice_number = ? AND id != ?",
      [data.invoice_number, invoiceId]
    );

    if (existing.length > 0) {
      return res.status(400).json({
        message: "Invoice number already exists"
      });
    }

    // Update invoice
    const updateQuery = `
    UPDATE invoice SET
    invoice_number = ?,
    purchase_order = ?,
    freelancer = ?,
    email = ?,
    website_link = ?,
    company_country = ?,
    company_address = ?,
    company_city = ?,
    company_postal = ?,
    company_state = ?,
    client_business = ?,
    client_email = ?,
    client_phone = ?,
    client_country = ?,
    client_address = ?,
    client_city = ?,
    client_state = ?,
    date = ?,
    total_amount = ?,
    tax = ?,
    discount = ?,
    shipping_fee = ?,
    due_date = ?,
    account_detail = ?,
    payment_terms = ?,
    client_postal = ?
    WHERE id = ?`;

    const values = [
      data.invoice_number,
      data.purchase_order,
      data.freelancer,
      data.email,
      data.website_link,
      data.company_country,
      data.company_address,
      data.company_city,
      data.company_postal,
      data.company_state,
      data.client_business,
      data.client_email,
      data.client_phone,
      data.client_country,
      data.client_address,
      data.client_city,
      data.client_state,
      data.date,
      data.total_amount,
      data.tax,
      data.discount,
      data.shipping_fee,
      data.due_date,
      data.account_detail,
      data.payment_terms,
      data.client_postal,
      invoiceId
    ];

    await db.promise().query(updateQuery, values);

    await db.promise().query(
      "DELETE FROM products WHERE invoice = ?",
      [invoiceId]
    );

    // Insert updated products
    for (let item of data.items) {

      const itemQuery = `
      INSERT INTO products
      (invoice, description, unit_cost, quantity, amount)
      VALUES (?,?,?,?,?)`;

      await db.promise().query(itemQuery, [
        invoiceId,
        item.description,
        item.unit_cost,
        item.quantity,
        item.amount
      ]);
    }
    if(userId!=null)
    {
      const [history] = await db.promise().query(
      `INSERT INTO history(user_id,invoice_id,type_of_history)
      VALUES (?,?,?)`,[userId,invoiceId,'invoice updated.']);
    }
    

    res.json({
      status: "success",
      message: "Invoice updated successfully"
    });

  } catch (error) {

    console.log(error);

    res.status(500).json({
      message: error.message
    });

  }
});

/*=================user Invoice======================*/
app.get("/api/invoice-list", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;

    // Get invoices of logged-in user
    const [invoices] = await db.promise().query(
      "SELECT * FROM invoice WHERE user_id = ? ORDER BY id DESC",
      [userId]
    );

    if (invoices.length === 0) {
      return res.json({
        status: "success",
        message: "No invoices found",
        data: []
      });
    }

    // Loop & attach products for each invoice
    for (let invoice of invoices) {
      const [products] = await db.promise().query(
        "SELECT * FROM products WHERE invoice = ?",
        [invoice.id]
      );

      invoice.items = products;

      const baseUrl = req.protocol + "://" + req.get("host");
      invoice.publicUrl = `${baseUrl}/invoicedetail/${invoice.public_token}`;
    }

    res.json({
      status: "success",
      data: invoices
    });

  } catch (error) {
    console.log(error);
    res.status(500).json({
      message: error.message
    });
  }
});

/*===============delete invoice======================*/
app.delete("/api/delete-invoice/:id", authMiddleware, async (req, res) => {
  try {
    const invoiceId = req.params.id;
    const userId = req.user.id;

    // Check invoice exists & belongs to user
    const [invoice] = await db.promise().query(
      "SELECT id FROM invoice WHERE id = ? AND user_id = ?",
      [invoiceId, userId]
    );

    if (invoice.length === 0) {
      return res.status(404).json({
        message: "Invoice not found or unauthorized"
      });
    }

    // Delete products first (FK issue avoid)
    await db.promise().query(
      "DELETE FROM products WHERE invoice = ?",
      [invoiceId]
    );

    // Delete invoice
    await db.promise().query(
      "DELETE FROM invoice WHERE id = ?",
      [invoiceId]
    );

    // Add history (optional)
    await db.promise().query(
      `INSERT INTO history(user_id,invoice_id,type_of_history)
       VALUES (?,?,?)`,
      [userId, invoiceId, 'invoice deleted']
    );

    res.json({
      status: "success",
      message: "Invoice deleted successfully"
    });

  } catch (error) {
    console.log(error);
    res.status(500).json({
      message: error.message
    });
  }
});