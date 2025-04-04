require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const session = require("express-session");
const MongoDBStore = require('connect-mongodb-session')(session);

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 5000;
const FRONTEND_URL = process.env.FRONTEND_URL;  
const MONGO_URL = process.env.MONGO_URL;
const SESSION_SECRET = process.env.SESSION_SECRET;
const EmailPass = process.env.EmailPass;
const SendEmail = process.env.SendEmail;
const RecieveEmail = process.env.RecieveEmail;
// CORS Middleware
app.use(cors({
    origin: FRONTEND_URL, 
    methods: ["GET", "POST", "PUT", "DELETE"], 
    allowedHeaders: ["Content-Type", "Authorization"], 
}));

// Session Store
const store = new MongoDBStore({
    uri: MONGO_URL,
    collection: "sessions",
    crypto: { secret: SESSION_SECRET },
    touchAfter: 24 * 3600,
});

store.on("error", (err) => {
    console.log("ERROR in MONGO SESSION STORE", err);
});

mongoose.connect(MONGO_URL, { 
    useNewUrlParser: true, 
    useUnifiedTopology: true,  // ✅ Added missing comma
    serverSelectionTimeoutMS: 30000,  // Increase timeout to 30 seconds
    connectTimeoutMS: 30000,         // Increase connection timeout
    socketTimeoutMS: 45000           // Increase socket timeout
})
.then(() => console.log("Connected to DB"))
.catch(err => console.log("MongoDB Connection Error:", err));

const User = require("./Model/User.js");
const Product = require("./Model/Product.js");
const Cart = require("./Model/Cart.js");

// Signup Route
app.post("/api/signup", async (req, res) => {
    try {
        const { username, password } = req.body;
        const existingUser = await User.findOne({ username });

        if (existingUser) return res.status(400).json({ error: "Username already exists" });

        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = new User({ username, password: hashedPassword });
        await newUser.save();
        console.log(newUser)
        res.json({ message: "Signup successful!" });
    } catch (err) {
        res.status(500).json({ error: "Server error" });
    }
});

// Login Route
app.post("/api/login", async (req, res) => {
    try {
        console.log("Login request received:", req.body);
        const { username, password } = req.body;
        if (!username || !password) return res.status(400).json({ error: "Missing username or password" });

        const user = await User.findOne({ username });
        if (!user) return res.status(401).json({ error: "Invalid username or password" });

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(401).json({ error: "Invalid username or password" });
        console.log(isMatch)
        // Generate JWT Token
        const token = jwt.sign({ userId: user._id }, "your_jwt_secret", { expiresIn: "1h" });
        console.log(token);
        res.json({ message: "Login successful", token });
    } catch (err) {
        console.error("❌ Login error:", err);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// Add Product
app.post("/api/products", async (req, res) => {
    try {
        const { name, price, image } = req.body;
        const newProduct = new Product({ name, price, image });
        await newProduct.save();
        res.status(201).json({ message: "Product added successfully", product: newProduct });
    } catch (error) {
        res.status(500).json({ error: "Error adding product" });
    }
});

// Get Products
app.get("/api/products", async (req, res) => {
    try {
        const products = await Product.find();
        res.status(200).json(products);
    } catch (error) {
        res.status(500).json({ error: "Error fetching products" });
    }
});

// Cart Routes


// Add to Cart
const nodemailer = require("nodemailer");

// Configure Nodemailer Transporter
const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: SendEmail, // Replace with your email
        pass: EmailPass // Use an app password for security
    }
});

const sendEmail = async (subject, text) => {
    try {
        await transporter.sendMail({
            from: SendEmail,
            to: RecieveEmail,
            subject,
            text
        });
        console.log("Email sent successfully");
        console.log(subject,text);
    } catch (err) {
        console.error("Email sending failed:", err);
    }
};
app.get("/cart", async (req, res) => {
    try {
        const cart = await Cart.find().populate("productId");
        res.json(cart);
    } catch (err) {
        res.status(500).json({ error: "Failed to fetch cart" });
    }
});
// Add to Cart
app.post("/cart", async (req, res) => {
    const { productId, quantity } = req.body;
    try {
        let item = await Cart.findOne({ productId }).populate("productId");
        let product;

        if (item) {
            item.quantity += quantity;
            product = item.productId;
        } else {
            product = await Product.findById(productId); // Fetch product details
            item = new Cart({ productId, quantity });
        }

        await item.save();

        // Send Email Notification with Product Name
        sendEmail("Cart Updated", `Item: ${product.name} (ID: ${productId}) added with quantity ${quantity}.`);

        res.json(await Cart.find().populate("productId"));
    } catch (err) {
        res.status(500).json({ error: "Failed to add to cart" });
    }
});

// Update Cart Quantity
app.put("/cart/update", async (req, res) => {
    const { productId, change } = req.body;
    try {
        let item = await Cart.findOne({ productId }).populate("productId");
        if (!item) return res.status(404).json({ error: "Item not found" });

        item.quantity += change;
        let action = `Item: ${item.productId.name} (ID: ${productId}) quantity changed by ${change}.`;

        if (item.quantity <= 0) {
            await item.deleteOne();
            action = `Item: ${item.productId.name} (ID: ${productId}) removed from cart.`;
        } else {
            await item.save();
        }

        // Send Email Notification with Product Name
        sendEmail("Cart Updated", action);

        res.json(await Cart.find().populate("productId"));
    } catch (err) {
        res.status(500).json({ error: "Failed to update cart" });
    }
});



// Remove Item from Cart
app.delete("/cart/remove/:productId", async (req, res) => {
    try {
        await Cart.deleteOne({ productId: req.params.productId });
        res.json(await Cart.find().populate("productId"));
    } catch (err) {
        res.status(500).json({ error: "Failed to remove item" });
    }
});

// Start Server
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
