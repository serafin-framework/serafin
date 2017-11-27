import * as VError from 'verror';
import { conflictError } from "../../serafin/error/Error"
import { PipelineSourceAbstract, description } from '../../serafin/pipeline';
import { ResourceIdentityInterface } from '../../serafin/pipeline/schema/ResourceInterfaces';
import { jsonMergePatch } from '../../serafin/util/jsonMergePatch';
import { PipelineSchemaModel } from '../../serafin/pipeline/schema/Model'
import * as _ from 'lodash'
import * as uuid from "node-uuid"

@description("Loads and stores resources as objects into memory. Any data stored here will be lost when node process exits. Ideal for unit tests and prototyping.")
export class PipelineSourceInMemory<
    T extends ResourceIdentityInterface,
    ReadQuery extends Partial<ResourceIdentityInterface> = Partial<T>,
    CreateResources = Partial<T>,
    UpdateValues = Partial<T>,
    PatchQuery extends Partial<ResourceIdentityInterface> = Partial<T>,
    PatchValues = Partial<T>,
    DeleteQuery extends Partial<ResourceIdentityInterface> = Partial<T>> extends PipelineSourceAbstract<T, ReadQuery, {}, {}, CreateResources, {}, UpdateValues, {}, PatchQuery, PatchValues, {}, DeleteQuery, {}> {
    protected resources: { [index: string]: T };

    constructor(schema: PipelineSchemaModel<T, ReadQuery, CreateResources, UpdateValues, PatchQuery, PatchValues, DeleteQuery>) {
        super(schema);
        this.resources = {} as { [index: string]: T };
    }

    private generateUUID(): string {
        var uid: string = uuid.v4();
        return uid.split("-").join("");
    }

    private toIdentifiedResource(resource: Partial<T>): Partial<T> {
        resource.id = resource['id'] || this.generateUUID();
        return resource;
    }

    private async readInMemory(query: any): Promise<{ results: T[] }> {
        if (!query) {
            query = {};
        }

        let resources = _.filter(this.resources, resource => {
            for (var property in query) {
                if (query[property] != resource[property as string]) {
                    return false;
                }
            }

            return true;
        });

        return { results: _.cloneDeep(resources) } as any;
    }

    protected async _create(resources: CreateResources[], options?: {}) {
        let createdResources: T[] = [];
        resources.forEach(resource => {
            let identifiedResource = this.toIdentifiedResource(resource);
            if (!this.resources[resource["id"]]) {
                this.resources[resource["id"]] = <any>_.cloneDeep(identifiedResource);
                createdResources.push(<any>identifiedResource);
            } else {
                // Todo: put the conflict test at beginning (for atomicity)
                throw conflictError(resource["id"])
            }
        });

        return createdResources;
    }

    protected async _read(query?: ReadQuery, options?: {}): Promise<{ results: T[] }> {
        return this.readInMemory(query)
    }

    protected async _update(id: string, values: UpdateValues, options?: {}): Promise<T> {
        var resources = await this.readInMemory({
            id: id
        });
        if (resources.results.length > 0) {
            var resource = resources.results[0]
            if (resource.id && resource.id !== id) {
                delete (this.resources[resource.id]);
            }
            // in case it wasn't assigned yet
            values["id"] = values["id"] || id;
            this.resources[id] = _.cloneDeep(values) as any;
            return values as any;
        }
        return undefined;
    }

    protected async _patch(query: PatchQuery, values: PatchValues, options?: {}) {
        var resources = await this.readInMemory(query);
        let updatedResources: T[] = [];

        resources.results.forEach(resource => {
            let id = resource.id;
            resource = jsonMergePatch(resource, values)
            if (resource.id !== id) {
                delete (this.resources[resource.id]);
            }
            this.resources[id] = _.cloneDeep(resource);
            updatedResources.push(resource);
        });

        return updatedResources;
    }

    protected async _delete(query?: DeleteQuery, options?: {}) {
        var resources = await this.readInMemory(query);
        let deletedResources: T[] = [];

        resources.results.forEach((resource) => {
            delete this.resources[resource.id];
            deletedResources.push(resource);
        });

        return deletedResources;
    }
}