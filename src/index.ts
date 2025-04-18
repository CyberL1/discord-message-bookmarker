import "@std/dotenv/load";
import fastify, { FastifyReply, FastifyRequest } from "fastify";
import { readdirSync } from "node:fs";

const app = fastify();

const routesDir = readdirSync(`${import.meta.dirname}/routes`, {
  recursive: true,
});

for (let file of routesDir) {
  if (typeof file === "string") {
    if (!file.endsWith(".ts")) {
      continue;
    }

    file = file.replaceAll("\\", "/");

    let route = `/${file.split(".").slice(0, -1).join(".")}`;
    route = route.replaceAll("_", ":");

    const routePath = route.endsWith("/index") ? route.slice(0, -6) : route;

    console.log(`Loading route: ${routePath}`);

    const routeModule = (await import(`./routes/${file}`)).default;

    Object.entries(routeModule).forEach(([method, handler]) => {
      app.route({
        method: method,
        url: routePath,
        handler: handler as (req: FastifyRequest, res: FastifyReply) => void,
      });
    });
  }
}

app.listen({ port: 80 }, (_, addr) => console.log("Server listening on", addr));
