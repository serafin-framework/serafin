/**
 * This file was automatically generated. DO NOT MODIFY.
 */

import { PipelineSchemaBuilderModel } from "../../../serafin/pipeline";

/**
 * Schema of a Pet object.
 */
export interface Item {
  id: string;
  name: string;
  price: number;
  categoryId?: string;
}
/**
 * This interface was referenced by `Item`'s JSON-Schema
 * via the `definition` "createValues".
 */
export interface CreateValues {
  id?: string;
  name: string;
  price: number;
  categoryId?: string;
}
/**
 * This interface was referenced by `Item`'s JSON-Schema
 * via the `definition` "updateValues".
 */
export interface UpdateValues {
  id?: string;
  name: string;
  price: number;
  categoryId?: string;
}
/**
 * This interface was referenced by `Item`'s JSON-Schema
 * via the `definition` "readQuery".
 */
export interface ReadQuery {
  /**
   * The identifier of the Pet. It is generated by the API.
   */
  id?: string | string[];
  /**
   * Item name
   */
  name?: string | string[];
  /**
   * Item price
   */
  price?: number | number[];
  /**
   * Category id
   */
  categoryId?: string | string[];
}
/**
 * This interface was referenced by `Item`'s JSON-Schema
 * via the `definition` "patchQuery".
 */
export interface PatchQuery {
  id: string | string[];
  name?: string | string[];
  price?: number | number[];
  categoryId?: string | string[];
}
/**
 * This interface was referenced by `Item`'s JSON-Schema
 * via the `definition` "patchValues".
 */
export interface PatchValues {
  name?: string;
  price?: number;
  categoryId?: string;
}
/**
 * This interface was referenced by `Item`'s JSON-Schema
 * via the `definition` "deleteQuery".
 */
export interface DeleteQuery {
  id: string | string[];
}


export var itemSchema = new PipelineSchemaBuilderModel<Item, ReadQuery, CreateValues, UpdateValues, PatchQuery, PatchValues, DeleteQuery>({"type":"object","title":"Item","description":"Schema of a Pet object.","properties":{"id":{"type":"string"},"name":{"type":"string"},"price":{"type":"number"},"categoryId":{"type":"string"}},"required":["id","name","price"],"additionalProperties":false,"definitions":{"createValues":{"type":"object","properties":{"id":{"type":"string"},"name":{"type":"string"},"price":{"type":"number"},"categoryId":{"type":"string"}},"additionalProperties":false,"required":["name","price"]},"updateValues":{"type":"object","properties":{"id":{"type":"string"},"name":{"type":"string"},"price":{"type":"number"},"categoryId":{"type":"string"}},"additionalProperties":false,"required":["name","price"]},"readQuery":{"type":"object","properties":{"id":{"oneOf":[{"type":"string"},{"type":"array","items":{"type":"string"}}],"description":"The identifier of the Pet. It is generated by the API."},"name":{"oneOf":[{"type":"string"},{"type":"array","items":{"type":"string"}}],"description":"Item name"},"price":{"oneOf":[{"type":"number"},{"type":"array","items":{"type":"number"}}],"description":"Item price"},"categoryId":{"oneOf":[{"type":"string"},{"type":"array","items":{"type":"string"}}],"description":"Category id"}},"additionalProperties":false},"patchQuery":{"type":"object","properties":{"id":{"oneOf":[{"type":"string"},{"type":"array","items":{"type":"string"}}]},"name":{"oneOf":[{"type":"string"},{"type":"array","items":{"type":"string"}}]},"price":{"oneOf":[{"type":"number"},{"type":"array","items":{"type":"number"}}]},"categoryId":{"oneOf":[{"type":"string"},{"type":"array","items":{"type":"string"}}]}},"additionalProperties":false,"required":["id"]},"patchValues":{"type":"object","properties":{"name":{"type":"string"},"price":{"type":"number"},"categoryId":{"type":"string"}},"additionalProperties":false},"deleteQuery":{"type":"object","properties":{"id":{"oneOf":[{"type":"string"},{"type":"array","items":{"type":"string"}}]}},"additionalProperties":false,"required":["id"]}}}, "Item");
