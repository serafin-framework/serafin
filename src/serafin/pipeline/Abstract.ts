import * as util from 'util';
import * as _ from 'lodash';
import { ReadWrapperInterface, ResourceIdentityInterface } from './schema/ResourceInterfaces';
import { JSONSchema4 } from "json-schema"
import * as jsonSchemaMergeAllOf from 'json-schema-merge-allof';
import { PipelineSchemaModel } from './schema/Model'
import { PipelineSchema } from './schema/Pipeline'
import { PipelineSchemaMethodOptions } from './schema/MethodOptions'
import { getOptionsSchemas } from './decorator/optionsSchemaSymbols'
import { final } from './decorator/Final'

/**
 * Utility method to add option metadata to a pipeline. As options metadata uses a private symbol internally, it is the only way to set it.
 * 
 * @param target 
 * @param method 
 * @param name 
 * @param schema 
 * @param description 
 * @param required 
 */

/**
 * Abstract Class representing a pipeline.
 * It contains the base type and method definition that all parts of pipelines must extend.
 * 
 * A pipeline is a component designed to define and modify a resource access behavior (read, write, delete actions...) using a functional approach.
 * A pipeline is always plugged (piped) to another pipeline except for source pipelines, and can affect one or many of the actions, by overriding them.
 */
export abstract class PipelineAbstract<
    T = {},
    ReadQuery = {},
    ReadOptions = {},
    ReadWrapper extends ReadWrapperInterface<T> = ReadWrapperInterface<T>,
    CreateResources = {},
    CreateOptions = {},
    UpdateValues = {},
    UpdateOptions = {},
    PatchQuery = {},
    PatchValues = {},
    PatchOptions = {},
    DeleteQuery = {},
    DeleteOptions = {}> {

    protected modelSchema: PipelineSchemaModel<ResourceIdentityInterface> = null;

    /**
     * The schema that represents the capabilities of this pipeline
     */
    get schema() {
        // find the nearest modelSchema defintion
        let findModelSchema = (target: PipelineAbstract) => target.modelSchema || (target.parent ? findModelSchema(target.parent) : null)

        // gather all options used by this pipeline and its parents
        let findAllOptions = (target: PipelineAbstract) => target ? [getOptionsSchemas(target), ...findAllOptions(target.parent)] : []

        // create and return the global schema representing the capabilities of this pipeline
        return new PipelineSchema(findModelSchema(this), PipelineSchema.mergeOptions(findAllOptions(this)))
    }

    /**
     * The parent pipeline. It has to be used internally by pipelines to access the next element of the pipeline.
     * Types are all 'any' because pipelines are general reusable blocks and they can't make assumption on what is the next element of the pipeline.
     */
    protected parent?: PipelineAbstract<any, any, any, any, any, any, any, any, any, any, any, any>;

    /**
     * Create new resources based on `resources` input array.
     * 
     * @param resources An array of partial resources to be created
     * @param options Map of options to be used by pipelines
     */
    @final async create(resources: CreateResources[], options?: CreateOptions): Promise<T[]> {
        return this._create(resources, options);
    }

    protected async _create(resources: CreateResources[], options?: CreateOptions): Promise<T[]> {
        return this.parent.create(resources, options);
    }

    /**
     * Read resources from the underlying source according to the given `query` and `options`.
     * 
     * @param query The query filter to be used for fetching the data
     * @param options Map of options to be used by pipelines
     */
    @final async read(query?: ReadQuery, options?: ReadOptions): Promise<ReadWrapper> {
        return this._read(query, options);
    }

    protected async _read(query?: ReadQuery, options?: ReadOptions): Promise<ReadWrapper> {
        return this.parent.read(query, options);
    }

    /**
     * Update replace an existing resource with the given values.
     * Because it replaces the resource, only one can be updated at a time.
     * If you need to update many resources in a single query, please use patch instead
     * 
     * @param id 
     * @param values 
     * @param options 
     */
    @final async update(id: string, values: UpdateValues, options?: UpdateOptions): Promise<T> {
        return this._update(id, values, options);
    }

    protected async _update(id: string, values: UpdateValues, options?: UpdateOptions): Promise<T> {
        return this.parent.update(id, values, options);
    }

    /**
     * Patch resources according to the given query and values.
     * The Query will select a subset of the underlying data source and given `values` are updated on it.
     * This method follow the JSON merge patch standard. @see https://tools.ietf.org/html/rfc7396
     * 
     * @param query 
     * @param values 
     * @param options 
     */
    @final async patch(query: PatchQuery, values: PatchValues, options?: PatchOptions): Promise<T[]> {
        return this._patch(query, values, options);
    }

    protected async _patch(query: PatchQuery, values: PatchValues, options?: PatchOptions): Promise<T[]> {
        return this.parent.patch(query, values, options);
    }

    /**
     * Delete resources that match th given Query.
     * @param query The query filter to be used for selecting resources to delete
     * @param options Map of options to be used by pipelines
     */
    @final async delete(query: DeleteQuery, options?: DeleteOptions): Promise<T[]> {
        return this._delete(query, options);
    }

    protected async _delete(query: DeleteQuery, options?: DeleteOptions): Promise<T[]> {
        return this.parent.delete(query, options);
    }

    public static getCRUDMethods() {
        return ['create', 'read', 'update', 'patch', 'delete'];
    }

    /**
     * Get a readable description of what this pipeline does
     */
    toString(): string { 
        let recursiveSchemas = (target: PipelineAbstract) => target ? [(new PipelineSchema(target.modelSchema, getOptionsSchemas(target), Object.getPrototypeOf(target).constructor.description, Object.getPrototypeOf(target).constructor.name)).schema, ...recursiveSchemas(target.parent)] : [];
        return (util.inspect(recursiveSchemas(this), false, null));
    }

    /**
     * Combine the given pipeline with this one.
     * /!\ the provided pipeline MUST NOT be reused somewhere else. The `parent` property can be assigned only once.
     * 
     * @param pipeline The pipeline to link with this one
     */
    pipe<N extends Partial<T>, NReadQuery, NReadOptions, NReadWrapper extends ReadWrapperInterface<N>, NCreateResources, NCreateOptions, NUpdateValues, NUpdateOptions, NPatchQuery, NPatchValues, NPatchOptions, NDeleteQuery, NDeleteOptions>(pipeline: PipelineAbstract<N, NReadQuery, NReadOptions, NReadWrapper, NCreateResources, NCreateOptions, NUpdateValues, NUpdateOptions, NPatchQuery, NPatchValues, NPatchOptions, NDeleteQuery, NDeleteOptions>) {
        if (pipeline.parent) {
            throw new Error("Pipeline Error: The provided pipeline is already attached to an existing parent pipeline")
        }
        pipeline.parent = this;

        // cast the pipeline and combine all interfaces
        var chainedPipeline: PipelineAbstract<T, ReadQuery & NReadQuery, ReadOptions & NReadOptions, ReadWrapper & NReadWrapper, CreateResources & NCreateResources, CreateOptions & NCreateOptions, UpdateValues & NUpdateValues, UpdateOptions & NUpdateOptions, PatchQuery & NPatchQuery, PatchValues & NPatchValues, PatchOptions & NPatchOptions, DeleteQuery & NDeleteQuery, DeleteOptions & NDeleteOptions> = <any>pipeline;
        return chainedPipeline;
    }

    /**
     * Project the current pipeline changing the underlying resource.
     * /!\ the provided projection MUST NOT be reused somewhere else. The `parent` property can be assigned only once. 
     * 
     * @param pipeline The pipeline to link with this one
     */
    project<N, NReadQuery, NReadOptions, NReadWrapper extends ReadWrapperInterface<N>, NCreateResources, NCreateOptions, NUpdateValues, NUpdateOptions, NPatchQuery, NPatchValues, NPatchOptions, NDeleteQuery, NDeleteOptions>(pipeline: PipelineProjectionAbstract<T, N, ReadQuery, ReadOptions, ReadWrapper, CreateResources, CreateOptions, UpdateValues, UpdateOptions, PatchQuery, PatchValues, PatchOptions, DeleteQuery, DeleteOptions, NReadQuery, NReadOptions, NReadWrapper, NCreateResources, NCreateOptions, NUpdateValues, NUpdateOptions, NPatchQuery, NPatchValues, NPatchOptions, NDeleteQuery, NDeleteOptions>): PipelineAbstract<N, NReadQuery, NReadOptions, NReadWrapper, NCreateResources, NCreateOptions, NUpdateValues, NUpdateOptions, NPatchQuery, NPatchValues, NPatchOptions, NDeleteQuery, NDeleteOptions> {
        if (pipeline.parent) {
            throw new Error("Pipeline Error: The provided pipeline is already attached to an existing parent pipeline")
        }
        pipeline.parent = this;
        return <any>pipeline;
    }
}

/**
 * Type definition of a Projection Pipeline. It has to be used when the pipeline fondamentaly changes the nature of the data it provides : T -> N
 */
export abstract class PipelineProjectionAbstract<T, N, ReadQuery = {}, ReadOptions = {}, ReadWrapper extends ReadWrapperInterface<T> = ReadWrapperInterface<T>, CreateResources = {}, CreateOptions = {}, UpdateValues = {}, UpdateOptions = {}, PatchQuery = {}, PatchValues = {}, PatchOptions = {}, DeleteQuery = {}, DeleteOptions = {}, NReadQuery = ReadQuery, NReadOptions = ReadOptions, NReadWrapper extends ReadWrapperInterface<N> = { results: N[] }, NCreateResources = CreateResources, NCreateOptions = CreateOptions, NUpdateValues = UpdateValues, NUpdateOptions = UpdateOptions, NPatchQuery = PatchQuery, NPatchValues = PatchValues, NPatchOptions = PatchOptions, NDeleteQuery = DeleteQuery, NDeleteOptions = DeleteOptions> extends PipelineAbstract<N, NReadQuery, NReadOptions, NReadWrapper, NCreateResources, NCreateOptions, NUpdateValues, NUpdateOptions, NPatchQuery, NPatchValues, NPatchOptions, NDeleteQuery, NDeleteOptions> {

}
