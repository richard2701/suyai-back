const { parse } = require("pg-connection-string");

module.exports = ({ env }) => {
  const { host, port, database, user, password } = parse(env("DATABASE_URL"));
  const useSsl = env.bool("DATABASE_SSL", false);

  return {
    connection: {
      client: "postgres",
      connection: {
        host,
        port,
        database,
        user,
        password,
        ssl: useSsl
          ? { rejectUnauthorized: env.bool("DATABASE_SSL_REJECT_UNAUTHORIZED", true) }
          : false,
      },
      debug: false,
    },
  };
};
