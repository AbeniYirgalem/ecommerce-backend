import swaggerJSDoc from "swagger-jsdoc";

const swaggerDefinition = {
  openapi: "3.0.0",
  info: {
    title: "UniBazzar API",
    version: "1.0.0",
    description: "Campus marketplace backend API",
  },
  servers: [
    {
      url: "http://localhost:5000",
      description: "Local server",
    },
    {
      url: "https://ecommerce-backend-wcy3.onrender.com",
      description: "Production server",
    },
  ],
};

const options = {
  definition: swaggerDefinition,
  // Keep the requested pattern and include src routes for this project structure.
  apis: ["./routes/*.js", "./src/routes/*.js"],
};

const swaggerSpec = swaggerJSDoc(options);

export default swaggerSpec;
