const mongoose = require("mongoose");

const ProductSchema = new mongoose.Schema({
    name: { type: String, required: true },
    price: { type: Number, required: true },
    image: { type: String},
});

const Product = mongoose.model("Product", ProductSchema);
module.exports = Product;
