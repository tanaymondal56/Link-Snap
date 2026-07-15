module.exports = {
  apps: [
    {
      name: "linksnap",
      script: "./index.js",
      instances: "max",
      exec_mode: "cluster",
      node_args: "--env-file=.env",
      env: {
        NODE_ENV: "production"
      }
    }
  ]
};
