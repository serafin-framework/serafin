import { SchemaBuilder } from "@serafin/schema-builder"

export var authorSchemaBuilder = SchemaBuilder.emptySchema({ title: "Author", description: "Author object." })
  .addString("id", { description: "Author identifier" })
  .addString("firstName", { description: "Author first name" })
  .addString("lastName", { description: "Author last name" }, false)
