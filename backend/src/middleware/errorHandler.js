function errorHandler(err, req, res, next) {
  console.error(`[${new Date().toISOString()}] ERROR:`, err.message || err);

  const status  = err.status || err.statusCode || 500;
  const message = process.env.NODE_ENV === "production" && status === 500
    ? "Internal server error"
    : err.message || "Something went wrong";

  res.status(status).json({ error: message });
}

module.exports = { errorHandler };
