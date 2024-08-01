import mongoose from "mongoose";
import { Schema } from "mongoose";

const UserSchema = new Schema({
    username: {
        type: String,
        required: true,
        unique: true,
        min: 4,
    },
    password: {
        type: String,
        required: true,
    }
}, {
    timestamps: true // Adds createdAt and updatedAt fields
});

const UserModel = mongoose.model('User', UserSchema);

export default UserModel;
