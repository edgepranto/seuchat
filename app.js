// external imports
const express = require("express");
const http = require("http");
const dotenv = require("dotenv");
const mongoose = require("mongoose");
const path = require("path");
const cookieParser = require("cookie-parser");
const moment = require("moment");

// internal imports
const loginRouter = require("./router/loginRouter");
const usersRouter = require("./router/usersRouter");
const inboxRouter = require("./router/inboxRouter");
const Conversation = require("./models/Conversation");

// internal imports
const {
  notFoundHandler,
  errorHandler,
} = require("./middlewares/common/errorHandler");

const app = express();
const server = http.createServer(app);
dotenv.config();

// socket creation
const io = require("socket.io")(server);
global.io = io;

// set comment as app locals
app.locals.moment = moment;

async function createDefaultAdmin() {
  try {
    const adminExists = await People.findOne({ role: "admin" });
    if (!adminExists) {
      const hashedPassword = await bcrypt.hash("admin123", 10);
      const admin = new People({
        name: "Default Admin",
        email: "admin@gmail.com",
        mobile: "0000000000",
        password: hashedPassword,
        role: "admin",
      });
      await admin.save();
      console.log("Default admin created");
    }
  } catch (error) {
    console.error("Error creating default admin:", error);
  }
}


// database connection
mongoose
  .connect(process.env.MONGO_CONNECTION_STRING, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => {
    console.log("database connection successful!");
    // create default admin after DB connection is established
    createDefaultAdmin();
  })
  .catch((err) => console.log(err));

// request parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// set view engine
app.set("view engine", "ejs");

// set static folder
app.use(express.static(path.join(__dirname, "public")));

// parse cookies
app.use(cookieParser(process.env.COOKIE_SECRET));

// routing setup
app.use("/", loginRouter);
app.use("/users", usersRouter);
app.use("/inbox", inboxRouter);

// 404 not found handler
app.use(notFoundHandler);

// common error handler
app.use(errorHandler);

// create default admin
const People = require("./models/People");
const bcrypt = require("bcrypt");


// search user
app.delete("/search", async (req, res) => {
  const query = req.query.query || "";
  const userId = req.session.user.userid; // adjust as per your session

  // Example: search by participant or creator name (case-insensitive)
  const conversations = await Conversation.find({
    $and: [
      { $or: [{ "creator.id": userId }, { "participant.id": userId }] },
      {
        $or: [
          { "creator.name": { $regex: query, $options: "i" } },
          { "participant.name": { $regex: query, $options: "i" } },
        ],
      },
    ],
  }).sort({ last_updated: -1 });

  res.json({ data: conversations });
});

// delete conversation
app.delete("/conversation/:id", async (req, res) => {
  const conversationId = req.params.id;
  const userId = req.session.user.userid; // adjust as per your session

  try {
    const conversation = await Conversation.findById(conversationId);

    if (!conversation) {
      return res.status(404).json({ message: "Conversation not found" });
    }

    // Check if the user is part of the conversation
    if (
      conversation.creator.id !== userId &&
      conversation.participant.id !== userId
    ) {
      return res
        .status(403)
        .json({
          message: "You are not authorized to delete this conversation",
        });
    }

    await Conversation.findByIdAndDelete(conversationId);
    res.json({ message: "Conversation deleted successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
});

server.listen(process.env.PORT, () => {
  console.log(`app listening to port ${process.env.PORT}`);
});
