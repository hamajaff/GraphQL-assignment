/** @format */

const path = require("path");
const fsPromises = require("fs/promises");
const {
  fileExists,
  readJsonFile,
  deleteFile,
  getDirectoryFileNames,
} = require("../utils/fileHandling");
const { GraphQLError, printType } = require("graphql");
const crypto = require("crypto");
const { productStatusEnum, productTypeEnum } = require("../enums/product");
const { parse } = require("path");
const axios = require("axios").default;

const cartsDirectory = path.join(__dirname, "..", "data", "carts");
const productsDirectory = path.join(__dirname, "..", "data", "products");

exports.resolvers = {
  Query: {
    getCartById: async (_, args) => {
      const cartId = args.cartId;
      const cartsFilePath = path.join(cartsDirectory, `${cartId}.json`);
      const cartExits = await fileExists(cartsFilePath);
      if (!cartExits) return new GraphQLError("The cart doesnt exist");

      const cartData = await fsPromises.readFile(cartsFilePath, {
        encoding: "utf-8",
      });
      const data = JSON.parse(cartData);
      return data;
    },

    getAllCarts: async (_, args) => {
      const carts = await getDirectoryFileNames(cartsDirectory);
      const cartData = [];

      for (const file of carts) {
        const filePath = path.join(cartsDirectory, file);
        const fileContents = await fsPromises.readFile(filePath, {
          encoding: "utf-8",
        });
        const data = JSON.parse(fileContents);
        cartData.push(data);
      }

      return cartData;
    },

    getProductById: async (_, args) => {
      const productId = args.productId;
      const productFilePath = path.join(productsDirectory, `${productId}.json`);
      const productExits = await fileExists(productFilePath);
      if (!productExits) return new GraphQLError("The product doesnt exist");

      const productData = await fsPromises.readFile(productFilePath, {
        encoding: "utf-8",
      });
      const data = JSON.parse(productData);
      return data;
    },

    getAllProducts: async (_, args) => {
      const products = await getDirectoryFileNames(productsDirectory);
      const productData = [];

      for (const file of products) {
        const filePath = path.join(productsDirectory, file);
        const fileContents = await fsPromises.readFile(filePath, {
          encoding: "utf-8",
        });
        const data = JSON.parse(fileContents);
        productData.push(data);
      }

      return productData;
    },
  },

  Mutation: {
    createCart: async (_, args) => {
      if (args.cartName.length === 0)
        return new GraphQLError("Name must be at least 1 character long");

      const newCart = {
        cartId: crypto.randomUUID(),
        cartName: args.cartName,
        totalPrice: args.totalPrice || 0,
        product: args.product || [],
      };

      let filePath = path.join(cartsDirectory, `${newCart.cartId}.json`);

      const idExists = await fileExists(filePath);

      if (idExists) {
        return new GraphQLError("Cart does not exist");
      } else {
        newCart.cartId = crypto.randomUUID();
        filePath = path.join(cartsDirectory, `${newCart.cartId}.json`);
      }

      await fsPromises.writeFile(filePath, JSON.stringify(newCart));

      return newCart;
    },

    updateCart: async (_, args) => {
      const { cartId, cartName, totalPrice, products } = args;
      const filePath = path.join(cartsDirectory, `${cartId}.json`);
      const cartExists = await fileExists(filePath);
      if (!cartExists) return new GraphQLError("Cart does not exist");

      const updatedCart = {
        cartId,
        cartName,
        totalPrice,
        products,
      };

      await fsPromises.writeFile(filePath, JSON.stringify(updatedCart));

      return updatedCart;
    },
    deleteCart: async (_, args) => {
      const cartId = args.cartId;

      const filePath = path.join(cartsDirectory, `${cartId}.json`);

      const cartExists = await fileExists(filePath);
      if (!cartExists) return new GraphQLError("That cart does not exist");

      try {
        await deleteFile(filePath);
      } catch (error) {
        return {
          deletedId: cartId,
          success: false,
        };
      }

      return {
        deletedId: cartId,
        success: true,
      };
    },

    createProduct: async (_, args) => {
      const {
        productId,
        productName,
        productPrice,
        productType,
        productStatus,
      } = args.input;

      if (productName?.length === 0)
        return new GraphQLError("Name must be at least 1 character long");

      const newProduct = {
        productId: crypto.randomUUID(),
        productName: productName,
        productPrice: productPrice,
        productType: productType || productTypeEnum.GEL,
        productStatus: productStatus || productStatusEnum.IN_STOCK,
      };

      const filePath = path.join(
        productsDirectory,
        `${newProduct.productId}.json`
      );

      await fsPromises.writeFile(filePath, JSON.stringify(newProduct));

      return newProduct;
    },

    deleteProduct: async (_, args) => {
      const productId = args.productId;

      const filePath = path.join(productsDirectory, `${productId}.json`);

      const productExists = await fileExists(filePath);
      if (!productExists)
        return new GraphQLError("That product does not exist");

      try {
        await deleteFile(filePath);
      } catch (error) {
        return {
          deletedId: productId,
          success: false,
        };
      }

      return {
        deletedId: productId,
        success: true,
      };
    },

    addProductsToCart: async (_, args) => {
      const cart = args.cartId;
      const products = args.productId;

      const cartsFilePath = path.join(cartsDirectory, `${cart}.json`);
      const productsFilePath = path.join(productsDirectory, `${products}.json`);

      const cartData = await fsPromises.readFile(cartsFilePath, {
        encoding: "utf-8",
      });
      const cartsData = JSON.parse(cartData);

      const productsExists = await fileExists(productsFilePath);
      if (!productsExists)
        return new GraphQLError("This product does not exist");

      if (productsExists) {
        const productData = await fsPromises.readFile(productsFilePath, {
          encoding: "utf-8",
        });
        const productsData = JSON.parse(productData);
        cartsData.product.push(productsData);

        const items = cartsData.product;
        let totalPrice = 0;

        items.forEach((product) => {
          totalPrice += product.productPrice;
        });

        cartsData.totalPrice = totalPrice;
      }

      if (!productsExists)
        return new GraphQLError("This product does not exist");

      await fsPromises.writeFile(cartsFilePath, JSON.stringify(cartsData));

      return cartsData;
    },

    removeProductsFromCart: async (_, args) => {
      const cart = args.cartId;
      const products = args.productId;

      const cartsFilePath = path.join(cartsDirectory, `${cart}.json`);
      const productsFilePath = path.join(productsDirectory, `${products}.json`);

      const cartExists = await fileExists(cartsFilePath);
      const productsExists = await fileExists(productsFilePath);

      if (!cartExists) return new GraphQLError("This cart does not exist");
      if (!productsExists)
        return new GraphQLError("This product does not exist");

      const cartData = await fsPromises.readFile(cartsFilePath, {
        encoding: "utf-8",
      });
      const productData = await fsPromises.readFile(productsFilePath, {
        encoding: "utf-8",
      });

      const cartsData = JSON.parse(cartData);
      const productsData = JSON.parse(productData);

      const cartItems = cartsData.product;
      const item = productsData.productId;

      const removeItem = (cartItems, item) => {
        const findIndex = cartItems.findIndex(
          (cartItems) => cartItems.productId === item
        );
        if (findIndex > -1) {
          cartItems.splice(findIndex, 1);
          let totalPrice = 0;
          cartItems.forEach((product) => {
            totalPrice += product.productPrice;
          });

          cartsData.totalPrice = totalPrice;
        }
        return cartItems;
      };
      removeItem(cartItems, item);

      await fsPromises.writeFile(cartsFilePath, JSON.stringify(cartsData));

      return cartsData;
    },

    emptyCart: async (_, args) => {
      const cart = args.cartId;

      const cartsFilePath = path.join(cartsDirectory, `${cart}.json`);

      const cartExists = await fileExists(cartsFilePath);

      if (!cartExists) return new GraphQLError("This cart does not exist");

      const cartData = await fsPromises.readFile(cartsFilePath, {
        encoding: "utf-8",
      });

      const cartsData = JSON.parse(cartData);

      const cartItems = cartsData.product;

      if (cartItems.length > 0) {
        cartItems.splice(0);
        let totalPrice = 0;
        cartItems.forEach((product) => {
          totalPrice += product.productPrice;
        });

        cartsData.totalPrice = totalPrice;
      }

      await fsPromises.writeFile(cartsFilePath, JSON.stringify(cartsData));

      return cartsData;
    },
  },
};
