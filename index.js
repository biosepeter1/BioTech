import bodyParser from "body-parser";
import express from "express";
import methodOverride from "method-override";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs/promises";
import multer from "multer";
import flash from "connect-flash";
import session from "express-session";

const port = process.env.PORT || 3000;
const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const usersFilePath = path.join(__dirname, "users.json");
const postsFilePath = path.join(__dirname, "posts.json");

// Initialize required files
async function initializeFiles() {
    try {
        await fs.access(postsFilePath);
    } catch {
        await fs.writeFile(postsFilePath, '[]');
    }
    try {
        await fs.access(usersFilePath);
    } catch {
        await fs.writeFile(usersFilePath, '[]');
    }
}

// Session configuration
app.use(session({
    secret: "your_secret_key",
    resave: false,
    saveUninitialized: true,
}));

// Flash messages
app.use(flash());
app.use((req, res, next) => {
    res.locals.success = req.flash("success");
    next();
});

// Multer configuration for image uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, "public/images/");
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + "-" + file.originalname);
    }
});
const upload = multer({ storage });

// Middleware
app.use(express.static(path.join(__dirname, "public")));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(methodOverride("_method"));
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.set("view cache", false);
app.use(express.json());

// Route logging middleware
app.use((req, res, next) => {
    console.log(`${req.method} ${req.path}`);
    next();
});

// Data functions
async function loadUsers() {
    try {
        const data = await fs.readFile(usersFilePath, "utf8");
        return JSON.parse(data);
    } catch (err) {
        console.error("Error loading users:", err);
        return [];
    }
}

async function saveUsers(users) {
    try {
        await fs.writeFile(usersFilePath, JSON.stringify(users, null, 2), "utf8");
    } catch (err) {
        console.error("Error saving users:", err);
    }
}

async function loadPosts() {
    try {
        const data = await fs.readFile(postsFilePath, "utf8");
        return JSON.parse(data);
    } catch (err) {
        console.error("Error loading posts:", err);
        return [];
    }
}

async function savePosts(posts) {
    try {
        await fs.writeFile(postsFilePath, JSON.stringify(posts, null, 2), "utf8");
    } catch (err) {
        console.error("Error saving posts:", err);
    }
}

// Routes
app.get("/", async (req, res) => {
    const posts = await loadPosts();
    res.render("index", { posts });
});

app.get("/signup", (req, res) => {
    res.render("signup");
});

app.post("/signup", async (req, res) => {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
        return res.status(400).json({ 
            success: false,
            message: "All fields are required" 
        });
    }

    const users = await loadUsers();

    if (users.find((user) => user.email === email)) {
        return res.status(400).json({ 
            success: false,
            message: "Email already registered" 
        });
    }

    users.push({ username, email, password });
    await saveUsers(users);

    res.json({ 
        success: true,
        message: "Account created successfully! Redirecting to login..." 
    });
});

app.get("/login", (req, res) => {
    res.render("login");
});

app.post("/login", async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).send("All fields are required");
    }

    const users = await loadUsers();
    const user = users.find(u => u.email === email && u.password === password);

    if (!user) {
        return res.status(401).send("Invalid email or password");
    }

    return res.status(200).send("Login successful");
});

app.get("/submit", async (req, res) => {
    const posts = await loadPosts();
    const newPostId = req.session.newPostId || null;
    res.render("index1", { posts, newPostId });
    delete req.session.newPostId;
});

app.get("/posts/new", (req, res) => {
    res.render("login");
});

app.get("/posts", (req, res) => {
    res.render("posts-form");
});

app.post("/posts", upload.single("image"), async (req, res) => {
    const { title, content, author, category } = req.body;
    if (!title || !content) {
        return res.status(400).send("Title and content are required");
    }
    const posts = await loadPosts();
    const newPost = {
        id: Date.now().toString(), // ID as string
        title,
        content,
        author: author || "Anonymous",
        date: new Date().toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric",
        }),
        category: category || "General",
        image: req.file ? `/images/${req.file.filename}` : "/images/placeholder.jpg"
    };
    posts.unshift(newPost);
    await savePosts(posts);

    req.session.newPostId = newPost.id;
    req.flash("success", "Article published successfully!");
    res.redirect("/submit");
});

app.get("/posts/:id", async (req, res) => {
    const posts = await loadPosts();
    const post = posts.find((post) => post.id === req.params.id); // String comparison
    if (!post) {
        return res.status(404).send("Post not found");
    }
    res.render("post-detail", { post });
});

app.get("/posts/:id/edit", async (req, res) => {
    const posts = await loadPosts();
    const post = posts.find((p) => p.id === req.params.id); // String comparison
    if (!post) {
        return res.status(404).send("Post not found");
    }
    res.render("edit-form", { post });
});

app.put("/posts/:id", upload.single("image"), async (req, res) => {
    const { title, content, author, category } = req.body;
    const postId = req.params.id; // Keep as string
    let posts = await loadPosts();
    posts = posts.map((post) =>
        post.id === postId
            ? {
                  ...post,
                  title,
                  content,
                  author: author || "Anonymous",
                  category: category || "General",
                  image: req.file ? `/images/${req.file.filename}` : post.image,
                  updatedAt: new Date().toISOString(),
              }
            : post
    );
    await savePosts(posts);

    req.session.newPostId = postId;
    req.flash("success", "Article updated successfully!");
    res.redirect("/submit");
});

app.delete("/posts/:id", async (req, res) => {
    const postId = req.params.id; // Keep as string
    let posts = await loadPosts();
    posts = posts.filter((post) => post.id !== postId);
    await savePosts(posts);

    req.flash("success", "Article deleted successfully!");
    res.redirect("/submit");
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('Something broke!');
});

// Initialize files and start server
initializeFiles().then(() => {
    app.listen(port, () => {
        console.log(`Server is running on :${port}`);
    });
});