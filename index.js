import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import UserModel from './models/User.js';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import cookieParser from 'cookie-parser';
import multer from 'multer';
import fs from 'fs';
import PostModel from './models/Post.js';
import { fileURLToPath } from 'url'
import path from 'path'
import dotenv from 'dotenv'
import { frontEndurl } from './helper.js';
import {v2 as cloudinary} from 'cloudinary'



dotenv.config();
const port = process.env.port || 4001;
const origin = process.env.ORIGIN

cloudinary.config({
  cloud_name: 'deaatlwug', // replace with your Cloudinary cloud name
  api_key: '532323265239733',       // replace with your Cloudinary API key
  api_secret: 'QYlJO6QB6gd56j9u4luuz33HSuI'  // replace with your Cloudinary API secret
});

const app = express();
const uploadMiddleware = multer({ dest: 'uploads/' });

const salt = bcrypt.genSaltSync(10);
const secret = 'asdfe45we45w345wegw345werjktjwertkj';

app.use(cors({ credentials: true, origin: ['http://localhost:5173', 'https://mybblogapp.netlify.app']}));

app.use(express.json());
app.use(cookieParser());

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use('/Uploads', express.static(path.join(__dirname, 'Uploads')));

const upload = multer({ dest: 'uploads/' }); // Temporary storage


app.post('/register', async (req, res) => {
  const { username, password } = req.body;

  const userDoc = await UserModel.findOne({ username: username });
  // console.log(userDoc);

  if (userDoc) {
    res.status(400).json({ message: 'username already exists' })
    return;
  } 
    
  try {
    const userDoc = await UserModel.create({
      username,
      password: bcrypt.hashSync(password, salt),
    });
    res.json(userDoc);
  } catch (e) {
    console.log(e);
    res.status(400).json(e);
  }
});

app.post('/login', async (req, res) => {
  const { username, password } = req.body;

  try {
    // Find user by username
    const userDoc = await UserModel.findOne({ username });

    // Check if user exists
    if (!userDoc) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Verify password
    const passOk = bcrypt.compareSync(password, userDoc.password);

    if (passOk) {
      // Generate JWT token
      jwt.sign({ username, id: userDoc._id }, secret, { expiresIn: '1h' }, (err, token) => {
        if (err) {
          console.error('Token generation error:', err);
          return res.status(500).json({ message: 'Internal server error' });
        }

        // Set cookie and respond
        res.cookie('token', token, {
          httpOnly: true, // Prevent client-side access to the token
          secure: true, // Set to true to ensure cookies are only sent over HTTPS
          sameSite: 'None', // Allow cross-origin requests in production
          path: '/', // Cookie should be available across the entire site
          maxAge: 3600000, // Cookie expiration (1 hour in milliseconds)
        });      

        res.json({
          id: userDoc._id,
          username,
        });
      });
    } else {
      res.status(400).json({ message: 'Wrong credentials' });
    }
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});



app.get('/profile', (req, res) => {
  const { token } = req.cookies;
  jwt.verify(token, secret, {}, (err, info) => {
    if (err) throw err;
    res.json(info);
  });
});

app.post('/logout', (req, res) => {
  res.cookie('token', '').json('ok');
});





app.post('/post', upload.single('image'), async (req, res) => {
  try {
      // console.log('Cookies:', req.cookies);
      const token = req.cookies.token;
      // console.log('Token:', token);

      if (!token) {
          return res.status(401).json({ message: 'JWT token is missing' });
      }

      jwt.verify(token, secret, {}, async (err, info) => {
          if (err) {
              console.error('JWT Verification Error:', err);
              return res.status(401).json({ message: 'Unauthorized' });
          }

          const { path } = req.file;
          
          // Upload the image to Cloudinary
          const result = cloudinary.uploader.upload(path, async (error, result) => {
              if (error) {
                  console.error('Cloudinary Upload Error:', error);
                  return res.status(500).json({ message: 'Image upload failed' });
              }

              const { title, summary, content } = req.body;
              
              // Create a new post document in your database
              const postDoc = await PostModel.create({
                  title,
                  summary,
                  content,
                  cover: result.secure_url, // Use the secure URL from Cloudinary
                  author: info.id
              });

              res.json(postDoc);
          });
      });
  } catch (error) {
      console.error('Error creating post:', error);
      res.status(500).json({ message: 'Internal Server Error' });
  }
});







app.get('/post', async (req, res) => {

  const posts = await PostModel.find({})
    .populate('author', ['username'])
    .sort({ 'createdAt': -1 })
    .limit(20)

  res.send(posts)


})

app.put('/post/:id', uploadMiddleware.single('file'), async (req, res) => {
  try {
    const { title, summary, content } = req.body;

    if (req.file) {
      const { originalname, path } = req.file;
      const parts = originalname.split('.');
      const ext = parts[parts.length - 1];
      const newPath = path + '.' + ext;
      fs.renameSync(path, newPath);

      console.log(req.cookies.token);
      
      

      const { token } = req.cookies;
      jwt.verify(token, secret, {}, async (err, info) => {
        if (err) {
          console.error('JWT verification failed:', err);
          return res.status(500).send('Authentication failed');
        }

        const postDoc = await PostModel.findByIdAndUpdate(
          req.params.id,
          { title, summary, content, cover: newPath, author: info.id },
          { new: true }
        );

        res.json(postDoc);
      });
    } else {
      const postDoc = await PostModel.findByIdAndUpdate(
        req.params.id,
        { title, summary, content },
        { new: true }
      );

      res.json(postDoc);
    }
  } catch (error) {
    console.error('Error updating post:', error);
    res.status(500).send('Internal Server Error');
  }
});






app.get('/post/:id', async (req, res) => {

  const { id } = req.params;
  const postDoc = await PostModel.findById(id).populate('author', ['username']);

  res.json(postDoc)
});

app.delete('/delete/:id', async (req, res) => {

  const { id } = req.params;

  const deletedDoc = await PostModel.findByIdAndDelete(id);
  console.log(deletedDoc);

  res.json({ success: 'true', message: 'Post deleted successfully' });
  
})



// Connect to MongoDB and start the server
mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('Connected to MongoDB');
    app.listen(4000, () => {
      console.log(`server is running `);
    });
  })
  .catch(err => {
    console.error('Failed to connect to MongoDB', err);
  });
