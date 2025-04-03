const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema({
  username: String,
  password: String,
  cart: [
    {
      name: String,
      price: Number,
      quantity: Number,
      image: String,
    },
  ],
});

const User = mongoose.model("User", UserSchema);
module.exports = User;
