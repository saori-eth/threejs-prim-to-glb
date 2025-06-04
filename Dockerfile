# Use an official Node.js runtime as a parent image
# We use the version specified in package.json engines field (>=18.0.0), so Node 18 is a safe bet.
# Alpine Linux is used for a smaller image size.
FROM node:18-alpine

# Set the working directory in the container
WORKDIR /usr/src/app

# Copy package.json and package-lock.json (if available)
# Doing this separately leverages Docker's build cache
COPY package*.json ./

# Install app dependencies
# Using --production flag to install only dependencies, not devDependencies
# Using --omit=dev is the modern equivalent for npm v7+
RUN npm install --omit=dev

# Bundle app source
COPY . .

# The API in src/api.js listens on process.env.PORT || 3000.
# Fly.io will set the PORT environment variable.
# We can expose it here for documentation, though Fly.io handles mapping.
EXPOSE 3000

# Define the command to run the app
# This uses the "api" script from your package.json
CMD [ "npm", "run", "api" ] 