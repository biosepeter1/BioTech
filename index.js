import bodyParser from 'body-parser';
import express from 'express';
import methodOverride from 'method-override';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';
import multer from 'multer';
import flash from 'connect-flash';
import session from 'express-session';
import FileStore from 'session-file-store';

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const usersFilePath = path.join(__dirname, 'users.json');
const postsFilePath = path.join(__dirname, 'posts.json');
const imagesDir = path.join(__dirname, 'public', 'images');

const SessionFileStore = FileStore(session);

async function initializeFiles() {
    try {
        await fs.mkdir(imagesDir, { recursive: true });
        try {
            await fs.access(usersFilePath);
        } catch {
            await fs.writeFile(usersFilePath, JSON.stringify([], null, 2));
        }
        try {
            await fs.access(postsFilePath);
        } catch {
            await fs.writeFile(postsFilePath, JSON.stringify([], null, 2));
        }
    } catch (err) {
        console.error('Error initializing files:', err);
    }
}

app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(methodOverride('_method'));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.set('view cache', false);
app.use(express.json());
app.use(session({
    store: new SessionFileStore({
        path: './sessions',
        ttl: 86400,
        retries: 2,
        fileExtension: '.json',
        logFn: console.log
    }),
    secret: process.env.SESSION_SECRET || 'your_secret_key',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        maxAge: 24 * 60 * 60 * 1000,
        httpOnly: true
    }
}));
app.use(flash());
app.use((req, res, next) => {
    res.locals.success = req.flash('success');
    console.log('Flash messages set:', res.locals.success);
    next();
});

async function loadUsers() {
    try {
        const data = await fs.readFile(usersFilePath, 'utf8');
        return JSON.parse(data);
    } catch (err) {
        console.error('Error loading users:', err);
        return [];
    }
}

async function saveUsers(users) {
    try {
        await fs.writeFile(usersFilePath, JSON.stringify(users, null, 2), 'utf8');
    } catch (err) {
        console.error('Error saving users:', err);
        throw err;
    }
}

async function loadPosts() {
    try {
        const data = await fs.readFile(postsFilePath, 'utf8');
        return JSON.parse(data);
    } catch (err) {
        console.error('Error loading posts:', err);
        return [];
    }
}

async function savePosts(posts) {
    try {
        await fs.writeFile(postsFilePath, JSON.stringify(posts, null, 2), 'utf8');
    } catch (err) {
        console.error('Error saving posts:', err);
        throw err;
    }
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, imagesDir);
    },
    filename: (req, file, cb) => {
        cb(null, `${Date.now()}-${file.originalname}`);
    }
});
const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }
});

app.get('/', async (req, res) => {
    const posts = await loadPosts();
    res.render('index', { posts });
});

app.get('/signup', (req, res) => {
    res.render('signup');
});

app.post('/signup', async (req, res) => {
    try {
        const { username, email, password } = req.body;
        if (!username || !email || !password) {
            return res.status(400).json({
                success: false,
                message: 'All fields are required'
            });
        }
        const users = await loadUsers();
        if (users.find((user) => user.email === email)) {
            return res.status(400).json({
                success: false,
                message: 'Email already registered'
            });
        }
        users.push({ username, email, password });
        await saveUsers(users);
        res.json({
            success: true,
            message: 'Account created successfully! Redirecting to login...'
        });
    } catch (err) {
        console.error('Error signing up:', err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

app.get('/login', (req, res) => {
    res.render('login');
});

app.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).send('All fields are required');
        }
        const users = await loadUsers();
        const user = users.find(u => u.email === email && u.password === password);
        if (!user) {
            return res.status(401).send('Invalid email or password');
        }
        return res.status(200).send('Login successful');
    } catch (err) {
        console.error('Error logging in:', err);
        res.status(500).send('Server error');
    }
});

app.get('/submit', async (req, res) => {
    const posts = await loadPosts();
    const newPostId = req.session.newPostId || null;
    const success = req.flash('success');
    console.log('Rendering /submit with flash:', success);
    res.render('index1', { posts, newPostId, success });
    delete req.session.newPostId;
});

app.get('/posts/new', (req, res) => {
    res.render('login');
});

app.get('/posts', (req, res) => {
    res.render('posts-form');
});

app.post('/posts', upload.single('image'), async (req, res, next) => {
    try {
        const { title, content, author, category } = req.body;
        if (!title || !content) {
            return res.status(400).send('Title and content are required');
        }
        const posts = await loadPosts();
        const newPost = {
            id: Date.now(),
            title,
            content,
            author: author || 'Anonymous',
            date: new Date().toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            }),
            category: category || 'General',
            image: req.file ? `/images/${req.file.filename}` : '/images/placeholder.jpg'
        };
        posts.unshift(newPost);
        await savePosts(posts);
        req.session.newPostId = newPost.id;
        req.flash('success', 'Article published successfully!');
        console.log('Publish flash set:', req.flash('success'));
        res.redirect('/submit');
    } catch (err) {
        console.error('Error creating post:', err);
        next(err);
    }
});

app.get('/posts/:id', async (req, res) => {
    const posts = await loadPosts();
    const post = posts.find((post) => post.id === parseInt(req.params.id));
    if (!post) {
        return res.status(404).send('Post not found');
    }
    res.render('post-detail', { post });
});

app.get('/posts/:id/edit', async (req, res) => {
    const posts = await loadPosts();
    const post = posts.find((p) => p.id === parseInt(req.params.id));
    if (!post) {
        return res.status(404).send('Post not found');
    }
    res.render('edit-form', { post });
});

app.route('/posts/:id')
    .put(upload.single('image'), async (req, res, next) => {
        try {
            const { title, content, author, category } = req.body;
            const postId = parseInt(req.params.id);
            let posts = await loadPosts();
            const postExists = posts.find((post) => post.id === postId);
            if (!postExists) {
                return res.status(404).send('Post not found');
            }
            posts = posts.map((post) =>
                post.id === postId
                    ? {
                          ...post,
                          title,
                          content,
                          author: author || 'Anonymous',
                          category: category || 'General',
                          image: req.file ? `/images/${req.file.filename}` : post.image,
                          updatedAt: new Date().toISOString()
                      }
                    : post
            );
            await savePosts(posts);
            req.session.newPostId = postId;
            req.flash('success', 'Article updated successfully!');
            console.log('Update flash set:', req.flash('success'));
            res.redirect('/submit');
        } catch (err) {
            console.error('Error updating post:', err);
            next(err);
        }
    })
    .post(async (req, res, next) => {
        if (req.body._method === 'PUT') {
            try {
                const { title, content, author, category } = req.body;
                const postId = parseInt(req.params.id);
                let posts = await loadPosts();
                const postExists = posts.find((post) => post.id === postId);
                if (!postExists) {
                    return res.status(404).send('Post not found');
                }
                posts = posts.map((post) =>
                    post.id === postId
                        ? {
                              ...post,
                              title,
                              content,
                              author: author || 'Anonymous',
                              category: category || 'General',
                              image: req.file ? `/images/${req.file.filename}` : post.image,
                              updatedAt: new Date().toISOString()
                          }
                        : post
                );
                await savePosts(posts);
                req.session.newPostId = postId;
                req.flash('success', 'Article updated successfully!');
                console.log('Update flash set:', req.flash('success'));
                res.redirect('/submit');
            } catch (err) {
                console.error('Error updating post:', err);
                next(err);
            }
        } else if (req.body._method === 'DELETE') {
            try {
                const postId = parseInt(req.params.id);
                let posts = await loadPosts();
                const postExists = posts.find((post) => post.id === postId);
                if (!postExists) {
                    return res.status(404).send('Post not found');
                }
                posts = posts.filter((post) => post.id !== postId);
                await savePosts(posts);
                req.flash('success', 'Article deleted successfully!');
                console.log('Delete flash set:', req.flash('success'));
                res.redirect('/submit');
            } catch (err) {
                console.error('Error deleting post:', err);
                next(err);
            }
        } else {
            next();
        }
    })
    .delete(async (req, res, next) => {
        try {
            const postId = parseInt(req.params.id);
            let posts = await loadPosts();
            const postExists = posts.find((post) => post.id === postId);
            if (!postExists) {
                return res.status(404).send('Post not found');
            }
            posts = posts.filter((post) => post.id !== postId);
            await savePosts(posts);
            req.flash('success', 'Article deleted successfully!');
            console.log('Delete flash set:', req.flash('success'));
            res.redirect('/submit');
        } catch (err) {
            console.error('Error deleting post:', err);
            next(err);
        }
    });

app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).send('Something went wrong!');
});

initializeFiles().then(() => {
    fs.access('./sessions', fs.constants.W_OK)
        .then(() => console.log('Sessions directory is writable'))
        .catch(err => console.error('Sessions directory error:', err));
    const port = process.env.PORT || 3000;
    app.listen(port, '0.0.0.0', () => {
        console.log(`Server is running on :${port}`);
    });
});