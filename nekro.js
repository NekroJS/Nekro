const express = require("express");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const bodyParser = require("body-parser");
const cors = require("cors");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const session = require("express-session");
const mongoose = require("mongoose");
const multer = require("multer");
const fs = require("fs-extra");
const nodemailer = require("nodemailer");
const winston = require("winston");
const passport = require("passport");
const asyncErrors = require("express-async-errors");
const dotenv = require("dotenv");
const NodeCache = require("node-cache");

const { combine, timestamp, printf } = winston.format;
const logger = winston.createLogger({
  level: "info",
  format: combine(
    timestamp(),
    printf(
      ({ level, message, timestamp }) =>
        `${timestamp} [${level.toUpperCase()}]: ${message}`
    )
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: "logs.log" }),
  ],
});

const cache = new NodeCache();

mongoose.connect("mongodb://localhost/mydatabase", {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const UserSchema = new mongoose.Schema({
  username: String,
  password: String,
});

const User = mongoose.model("User", UserSchema);
const upload = multer({ dest: "uploads/" });

class NekroJS {
  constructor(port) {
    this.app = express();
    this.app.use(helmet());
    this.app.use(cors());
    this.app.use(bodyParser.json());
    this.app.use(bodyParser.urlencoded({ extended: false }));
    this.app.use(
      session({
        secret: "useEnv",
        resave: false,
        saveUninitialized: true,
      })
    );
    this.app.use(passport.initialize());
    this.app.use(passport.session());
    this.app.use(asyncErrors);
    this.routes = [];
    this.port = port || 3000;
    this.limiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 dakika
      max: 100, // Maksimum 100 istek
      message: "Too many requests, please try again later.",
    });
    this.app.use(limiter);
    this.user = {
      username: "useEnv",
      secretkey: "useEnv",
      password: "useEnv",
      mail: {
        transporter: {
          mail: "useEnv",
          pass: "useEnv",
        },
      },
    };
  }

  // Yeni bir GET yönlendiricisi ekleme metodunu tanımla
  addGetRoute(path, handler) {
    this.app.get(path, handler);
    this.routes.push({ method: "GET", path });
  }

  // Yeni bir POST yönlendiricisi ekleme metodunu tanımla
  addPostRoute(path, handler) {
    this.app.post(path, handler);
    this.routes.push({ method: "POST", path });
  }

  // NekroJS API yolunu tanımla
  setupAPI() {
    this.addGetRoute("/api", (req, res) => {
      res.send("Welcome to NekroJS API!");
    });
    this.addPostRoute("/api/data", async (req, res) => {
      const data = req.body;
      const hashedPassword = await bcrypt.hash(data.password, 10);
      const token = jwt.sign({ username: data.username }, "secretKey");
      const user = new User({
        username: data.username,
        password: hashedPassword,
      });
      await user.save();
      res.send(hashedPassword, token);
    });
    this.addPostRoute(
      "/api/upload",
      upload.single("file"),
      async (req, res) => {
        const file = req.file;
        const filePath = file.path;
        const fileContent = await fs.readFile(filePath, "utf-8");
        // Dosya içeriğiyle ilgili işlemler yapılabilir
        await fs.remove(filePath);
        res.send("File uploaded successfully!");
      }
    );
    this.addPostRoute("/api/sendmail", async (req, res) => {
      const { email, subject, message } = req.body;
      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: this.user.mail.transporter.mail,
          pass: this.user.mail.transporter.pass,
        },
      });
      const mailOptions = {
        from: this.user.mail.transporter.mail,
        to: email,
        subject,
        text: message,
      };
      await transporter.sendMail(mailOptions);
      res.send("Email sent successfully!");
    });
  }

  // Sunucuyu çalıştırma metodunu tanımla
  startServer() {
    this.app.listen(this.port, () => {
      console.log(`Server started on port ${this.port}`);
    });
  }
}
