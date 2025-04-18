import bodyParser from "body-parser";
import express from "express";
import methodOverride from "method-override";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs/promises"; // For async file operations
import multer from "multer"; // Added for image uploads
import flash from "connect-flash";
import session from "express-session";




const port = process.env.PORT || 3000;
const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const usersFilePath = path.join(__dirname, "users.json");

app.use(session({
    secret: "your_secret_key",
    resave: false,
    saveUninitialized: true,
  }));
  
  // Setup flash messages
  app.use(flash());
  
  // Middleware to expose flash messages to all views
  app.use((req, res, next) => {
    res.locals.success = req.flash("success");
    next();
  });

// Load users from JSON file
async function loadUsers() {
    try {
        const data = await fs.readFile(usersFilePath, "utf8");
        return JSON.parse(data);
    } catch (err) {
        console.error("Error loading users:", err);
        return [];
    }
}

// Save users to JSON file
async function saveUsers(users) {
    try {
        await fs.writeFile(usersFilePath, JSON.stringify(users, null, 2), "utf8");
    } catch (err) {
        console.error("Error saving users:", err);
    }
}


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
app.set("view cache", false); // Disable caching, as discussed
app.use(express.json());


// Path to posts.json
const postsFilePath = path.join(__dirname, "posts.json");

// Load posts from JSON file
async function loadPosts() {
    try {
        const data = await fs.readFile(postsFilePath, "utf8");
        return JSON.parse(data);
    } catch (err) {
        console.error("Error loading posts:", err);
        return []; // Return empty array if file doesn't exist
    }
}

// Save posts to JSON file
async function savePosts(posts) {
    try {
        await fs.writeFile(postsFilePath, JSON.stringify(posts, null, 2), "utf8");
    } catch (err) {
        console.error("Error saving posts:", err);
    }
}

// Users array (unchanged)
// const users = [];

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

    // You can also set a session or token here if needed
    return res.status(200).send("Login successful");
});

app.get("/submit", async (req, res) => {
    const posts = await loadPosts();
    const newPostId = req.session.newPostId || null; // Get newPostId from session
    res.render("index1", { posts, newPostId });
    // Optional: Clear newPostId from session to avoid reuse
    delete req.session.newPostId;
});


app.get("/posts/new", (req, res) => {
    res.render("login"); // Updated to render new.ejs, assuming login was a typo
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
        id: Date.now(), // Keep your unique ID logic
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
    posts.unshift(newPost); // Newest first
    await savePosts(posts);

    // Store the new post ID in the session
    req.session.newPostId = newPost.id;

    req.flash("success", "Article published successfully!");
    res.redirect("/submit");
});


app.get("/posts/:id", async (req, res) => {
    const posts = await loadPosts();
    const post = posts.find((post) => post.id === parseInt(req.params.id));
    if (!post) {
        return res.status(404).send("404");
    }
    res.render("post-detail", { post });
});

app.get("/posts/:id/edit", async (req, res) => {
    const posts = await loadPosts();
    const post = posts.find((p) => p.id === parseInt(req.params.id));
    if (!post) {
        return res.status(404).send("404");
    }
    res.render("edit-form", { post }); // Updated to render edit.ejs
});

app.put("/posts/:id", upload.single("image"), async (req, res) => {
    const { title, content, author, category } = req.body;
    const postId = parseInt(req.params.id);
    let posts = await loadPosts();
    posts = posts.map((post) =>
        post.id === postId
            ? {
                  ...post,
                  title,
                  content,
                  author: author || "Anonymous",
                  category: category || "General",
                  image: req.file ? `/images/${req.file.filename}` : post.image, // Retain existing image if none uploaded
                  updatedAt: new Date().toISOString(),
              }
            : post
    );
    await savePosts(posts);

    req.session.newPostId = postId;

    // Set flash message for update
    req.flash("success", "Article updated successfully!");
    res.redirect("/submit");
});

app.delete("/posts/:id", async (req, res) => {
    let posts = await loadPosts();
    posts = posts.filter((post) => post.id !== parseInt(req.params.id));
    await savePosts(posts);

    req.flash("success", "Article deleted successfully!");
    res.redirect("/submit");
});
app.get('/about', (req, res) => {
    res.render('about');
  });

  app.get('/contact', (req, res) => {
    res.render('404');
  });

  
  
app.listen(port, () => {
    console.log(`Server is running on :${port}`);
});