const asyncHandler = require("express-async-handler");
const crypto = require("crypto");
const User = require("../models/userModel");
const Chat = require("../models/chatModel");
const Message = require("../models/messageModel");

const algorithm = "aes-256-cbc";
const secretKey = crypto
  .createHash("sha256")
  .update("shashank")
  .digest("base64")
  .substr(0, 32); // Fixed key 'shashank'

const encrypt = (text) => {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(algorithm, Buffer.from(secretKey), iv);
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  return iv.toString("hex") + ":" + encrypted;
};

const decrypt = (text) => {
  const textParts = text.split(":");
  const iv = Buffer.from(textParts.shift(), "hex");
  const encryptedText = Buffer.from(textParts.join(":"), "hex");
  const decipher = crypto.createDecipheriv(
    algorithm,
    Buffer.from(secretKey),
    iv
  );
  let decrypted = decipher.update(encryptedText, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
};

const allMessages = asyncHandler(async (req, res) => {
  try {
    let messages = await Message.find({ chat: req.params.chatId })
      .populate("sender", "name pic email")
      .populate("chat");

    // Decrypt the content of each message
    messages = messages.map((message) => {
      message.content = decrypt(message.content);
      return message;
    });

    res.json(messages);
  } catch (error) {
    res.status(400);
    throw new Error(error.message);
  }
});

const sendMessage = asyncHandler(async (req, res) => {
  const { content, chatId } = req.body;

  if (!content || !chatId) {
    console.log("Invalid data passed into request");
    return res.sendStatus(400);
  }

  // Encrypt the content before saving it
  const encryptedContent = encrypt(content);

  var newMessage = {
    sender: req.user._id,
    content: encryptedContent,
    chat: chatId,
  };

  try {
    var message = await Message.create(newMessage);

    message = await message.populate("sender", "name pic").execPopulate();
    message = await message.populate("chat").execPopulate();
    message = await User.populate(message, {
      path: "chat.users",
      select: "name pic email",
    });

    await Chat.findByIdAndUpdate(req.body.chatId, { latestMessage: message });

    message.content = decrypt(message.content);

    res.json(message);
  } catch (error) {
    res.status(400);
    throw new Error(error.message);
  }
});

module.exports = { allMessages, sendMessage };
