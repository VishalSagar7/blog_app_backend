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
// import { frontEndurl } from './helper.js';


dotenv.config();
const port = process.env.port || 4001;
const origin = process.env.ORIGIN

const app = express();
const uploadMiddleware = multer({ dest: 'uploads/' });

const salt = bcrypt.genSaltSync(10);
const secret = 'asdfe45we45w345wegw345werjktjwertkj';

app.use(cors({ credentials: true, }));
// origin: frontEndurl
app.use(express.json());
app.use(cookieParser());

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use('/Uploads', express.static(path.join(__dirname, 'Uploads')));


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
      jwt.sign({ username, id: userDoc._id }, secret, {}, (err, token) => {
        if (err) {
          console.error('Token generation error:', err);
          return res.status(500).json({ message: 'Internal server error' });
        }

        // Set cookie and respond
        res.cookie('token', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production' });
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



app.post('/profile', (req, res) => {
  const { token } = req.cookies;
  jwt.verify(token, secret, {}, (err, info) => {
    if (err) throw err;
    res.json(info);
  });
});

app.post('/logout', (req, res) => {
  res.cookie('token', '').json('ok');
});



app.post('/post', uploadMiddleware.single('file'), async (req, res) => {

  // console.log(req.file);
  const { originalname, path } = req.file;
  const parts = originalname.split('.');
  const ext = parts[parts.length - 1];
  const newPath = path + '.' + ext;
  fs.renameSync(path, newPath);

  const { token } = req.cookies;

  jwt.verify(token, secret, {}, async (err, info) => {
    if (err) throw err;

    const { title, summary, content } = req.body;

    // console.log(info);

    const postDoc = await PostModel.create({
      title,
      summary,
      content,
      cover: newPath,
      author: info.id
    });

    res.json(postDoc);
  });



});




app.get('/post', async (req, res) => {

  const posts = await PostModel.find({})
    .populate('author', ['username'])
    .sort({ 'createdAt': -1 })
    .limit(20)

  res.send(posts)


})

app.put('/post/:id', uploadMiddleware.single('file'), async (req, res) => {
  
  const postId = req.params.id;

  try {
    // Verify JWT token
    const { token } = req.cookies;
    const info = jwt.verify(token, secret);

    // Find the post by ID
    const postDoc = await PostModel.findById(postId);

    if (!postDoc) {
      return res.status(404).json('Post not found');
    }

    // Update post fields
    const { title, summary, content } = req.body;
    postDoc.title = title || postDoc.title;
    postDoc.summary = summary || postDoc.summary;
    postDoc.content = content || postDoc.content;
    
    // Handle file upload if there is a new file
    if (req.file) {
      const { originalname, path: tempPath } = req.file;
      const ext = path.extname(originalname);
      const newPath = tempPath + ext;
      fs.renameSync(tempPath, newPath);
      postDoc.cover = newPath;
    }

    postDoc.author = info.id;

    // Save updated post document
    await postDoc.save();

    res.json(postDoc);
  } catch (error) {
    console.error('Error updating post:', error);
    res.status(500).json('Failed to update post');
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
      console.log('Server is running on port 4000');
    });
  })
  .catch(err => {
    console.error('Failed to connect to MongoDB', err);
  });
