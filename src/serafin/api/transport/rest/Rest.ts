import * as express from 'express';
import * as _ from 'lodash';
import * as VError from 'verror';
import * as Ajv from "ajv";
import { JSONSchema } from "../../../openApi"
import { TransportInterface } from "../TransportInterface"
import { PipelineAbstract } from "../../../pipeline/Abstract"
import { OpenApi } from "./OpenApi"
import { metaSchema } from "../../../openApi"
import { Api } from "../../Api"
import { serafinError, validationError, notFoundError, ValidationErrorName, NotFoundErrorName, ConflictErrorName, NotImplementedErrorName, UnauthorizedErrorName } from "../../../error/Error"
import { JsonHal } from './JsonHal';

export interface RestOptions {
    /**
     * If provided, the Api will use this function to gather internal options for this request.
     * It can be used for example to pass _user or _role to the underlying pipeline.
     */
    internalOptions?: (req: express.Request) => Object
}

export class RestTransport implements TransportInterface {
    protected api: Api
    constructor(protected options: RestOptions = {}) {
    }

    init(api: Api) {
        this.api = api;
    }

    /**
     * Use the given pipeline.
     * 
     * @param pipeline 
     * @param name 
     * @param pluralName 
     */
    use(pipeline: PipelineAbstract, name: string, pluralName: string) {
        // setup the router
        let endpointPath = `${this.api.basePath}/${pluralName}`;
        let resourcesPath = `/${pluralName}`;
        let router = express.Router();
        let openApi = new OpenApi(this.api, pipeline.schemaBuilder, resourcesPath, name, pluralName);

        // error handling closure for this endpoint
        let handleError = (error, res: express.Response, next: (err?: any) => void) => {
            // handle known errors
            if (![[ValidationErrorName, 400], [NotFoundErrorName, 404], [ConflictErrorName, 409], [NotImplementedErrorName, 405], [UnauthorizedErrorName, 401]].some((p: [string, number]) => {
                let [errorName, code] = p;
                if (VError.findCauseByName(error, errorName)) {
                    res.status(code).json({
                        code: code,
                        message: error.message
                    })
                    return true
                }
                return false
            })) {
                // or pass the error down the chain
                console.error(VError.fullStack(error));
                next(error)
            }
        };

        // import pipeline schemas to openApi definitions
        var pipelineSchemaBuilder = pipeline.schemaBuilder;

        // determine what are the available actions
        let canRead = !!pipelineSchemaBuilder.schema.definitions.readQuery
        let canCreate = !!pipelineSchemaBuilder.schema.definitions.createValues
        let canUpdate = !!pipelineSchemaBuilder.schema.definitions.updateValues
        let canPatch = !!pipelineSchemaBuilder.schema.definitions.patchValues
        let canDelete = !!pipelineSchemaBuilder.schema.definitions.deleteQuery

        this.testOptionsAndQueryConflict(pipelineSchemaBuilder.schema.definitions.readQuery, pipelineSchemaBuilder.schema.definitions.readOptions);
        this.testOptionsAndQueryConflict(pipelineSchemaBuilder.schema.definitions.patchQuery, pipelineSchemaBuilder.schema.definitions.patchOptions);
        this.testOptionsAndQueryConflict(pipelineSchemaBuilder.schema.definitions.deleteQuery, pipelineSchemaBuilder.schema.definitions.deleteOptions);

        // prepare Ajv filters
        let ajv = new Ajv({ coerceTypes: true, removeAdditional: true, useDefaults: true, meta: metaSchema });
        ajv.addSchema(pipelineSchemaBuilder.schema, "pipelineSchema");

        // create the routes for this endpoint
        if (canRead) {
            let readQueryFilter = ajv.compile({ "$ref": 'pipelineSchema#/definitions/readQuery' });
            let readOptionsFilter = ajv.compile({ "$ref": 'pipelineSchema#/definitions/readOptions' });

            // get many resources
            router.get("", (req: express.Request, res: express.Response, next: (err?: any) => void) => {
                let pipelineParams = null;
                try {
                    pipelineParams = this.extractOptionsAndQuery(req, ajv, readOptionsFilter, readQueryFilter);
                } catch (e) {
                    return handleError(e, res, next);
                }

                // run the query
                pipeline.read(pipelineParams.query, pipelineParams.options).then(wrapper => {
                    if (req.headers['content-type'] && req.headers['content-type'] == 'application/hal+json') {
                        let links = (new JsonHal(endpointPath, this.api, pipeline.relations)).links();
                        wrapper["_links"] = links;
                        if (wrapper.data) {
                            wrapper.data = wrapper.data.map((result) => {
                                if (result['id']) {
                                    result['_links'] = (new JsonHal(endpointPath + `/${result['id']}`, this.api, pipeline.relations)).links(result);
                                }
                                return result;
                            });
                        }
                    }

                    res.status(200).json(wrapper);
                    res.end();
                }).catch(error => {
                    handleError(Api.apiError(error, req), res, next)
                });
            })

            // get a resource by its id
            router.get("/:id", (req: express.Request, res: express.Response, next: (err?: any) => void) => {
                let id = req.params.id
                let pipelineParams = null;
                try {
                    pipelineParams = this.extractOptionsAndQuery(req, ajv, readOptionsFilter);
                } catch (e) {
                    return handleError(e, res, next);
                }

                // run the query
                pipeline.read({
                    id: id
                }, pipelineParams.options).then(wrapper => {
                    if (wrapper.data.length > 0) {
                        if (req.headers['content-type'] && req.headers['content-type'] == 'application/hal+json') {
                            wrapper.data[0]['_links'] = (new JsonHal(endpointPath + `/${id}`, this.api, pipeline.relations)).links(wrapper.data[0]);
                        }
                        res.status(200).json(wrapper.data[0])
                    } else {
                        throw notFoundError(`${name}:${id}`)
                    }
                    res.end();
                }).catch(error => {
                    handleError(Api.apiError(error, req), res, next)
                });
            })

            openApi.addReadDoc();
        }

        if (canCreate) {
            let createOptionsFilter = ajv.compile({ "$ref": 'pipelineSchema#/definitions/createOptions' });

            // create a new resource
            router.post("", (req: express.Request, res: express.Response, next: (err?: any) => void) => {
                let pipelineParams = null;
                try {
                    pipelineParams = this.extractOptionsAndQuery(req, ajv, createOptionsFilter);
                } catch (e) {
                    return handleError(e, res, next);
                }

                var data = req.body

                // run the query
                pipeline.create([data], pipelineParams.options).then(createdResources => {
                    if (createdResources.length !== 1) {
                        throw new Error(`Api Error: unexpected create result for endpoint ${resourcesPath}`)
                    }
                    res.status(201).json(createdResources[0])
                }).catch(error => {
                    handleError(Api.apiError(error, req), res, next)
                });
            });

            openApi.addCreateDoc();
        }

        if (canPatch) {
            let patchOptionsFilter = ajv.compile({ "$ref": 'pipelineSchema#/definitions/patchOptions' });

            // patch an existing resource
            router.patch("/:id", (req: express.Request, res: express.Response, next: (err?: any) => void) => {
                let pipelineParams = null;
                try {
                    pipelineParams = this.extractOptionsAndQuery(req, ajv, patchOptionsFilter);
                } catch (e) {
                    return handleError(e, res, next);
                }

                var patch = req.body
                var id = req.params.id

                // run the query
                pipeline.patch({
                    id: id
                }, patch, pipelineParams.options).then(updatedResources => {
                    if (updatedResources.length === 0) {
                        throw notFoundError(`${name}:${id}`)
                    } else {
                        res.status(200).json(updatedResources[0])
                    }
                    res.end()
                }).catch(error => {
                    handleError(Api.apiError(error, req), res, next)
                });
            })

            openApi.addPatchDoc();
        }

        if (canUpdate) {
            let updateOptionsFilter = ajv.compile({ "$ref": 'pipelineSchema#/definitions/updateOptions' });

            // put an existing resource
            router.put("/:id", (req: express.Request, res: express.Response, next: (err?: any) => void) => {
                let pipelineParams = null;
                try {
                    pipelineParams = this.extractOptionsAndQuery(req, ajv, updateOptionsFilter);
                } catch (e) {
                    return handleError(e, res, next);
                }

                var data = req.body
                var id = req.params.id

                // run the query
                pipeline.update(id, data, pipelineParams.options).then(updatedResource => {
                    if (!updatedResource) {
                        throw notFoundError(`${name}:${id}`)
                    } else {
                        res.status(200).json(updatedResource)
                    }
                    res.end()
                }).catch(error => {
                    handleError(Api.apiError(error, req), res, next)
                });
            });

            openApi.addUpdateDoc();
        }

        if (canDelete) {
            let deleteOptionsFilter = ajv.compile({ "$ref": 'pipelineSchema#/definitions/deleteOptions' });

            // delete an existing resource
            router.delete("/:id", (req: express.Request, res: express.Response, next: (err?: any) => void) => {
                let pipelineParams = null;
                try {
                    pipelineParams = this.extractOptionsAndQuery(req, ajv, deleteOptionsFilter);
                } catch (e) {
                    return handleError(e, res, next);
                }

                let id = req.params.id;

                // run the query
                pipeline.delete({
                    id: id
                }, pipelineParams.options).then(deletedResources => {
                    if (deletedResources.length === 0) {
                        throw notFoundError(`${name}:${id}`)
                    } else {
                        res.status(200).json(deletedResources[0])
                    }
                    res.end()
                }).catch(error => {
                    handleError(Api.apiError(error, req), res, next)
                });
            });

            openApi.addDeleteDoc();
        }

        // attach the router to the express app
        this.api.application.use(endpointPath, router);

        this.api.application.get(this.api.basePath, (req: express.Request, res: express.Response, next: (err?: any) => void) => {
            if (req.headers['content-type'] && req.headers['content-type'] == 'application/hal+json') {
                res.status(200).json({
                    _links: _.mapValues(this.api.pipelineByName, (pipeline, key) => {
                        return { href: `${this.api.basePath}/${key}` }
                    })
                });
            } else {
                throw notFoundError('/');
            }
        });
    }

    private extractOptionsAndQuery(req: express.Request, ajv: Ajv.Ajv, optionsFilter: Ajv.ValidateFunction, queryFilter: Ajv.ValidateFunction = null): { options: object, query: object } {
        let pipelineOptions = this.api.filterInternalOptions(_.cloneDeep(req.query));
        if (this.options.internalOptions) {
            _.merge(pipelineOptions, this.options.internalOptions(req));
        }
        let optionsValid = optionsFilter(pipelineOptions);

        let pipelineQuery = {};
        let queryValid = true;
        if (queryFilter !== null) {
            pipelineQuery = _.cloneDeep(req.query)
            let queryValid = queryFilter(pipelineQuery) as boolean;
        }

        if (!optionsValid || !queryValid) {
            throw Api.apiError(validationError(ajv.errorsText(optionsValid ? queryFilter.errors : optionsFilter.errors)), req)
        }

        return { options: pipelineOptions, query: pipelineQuery };
    }

    private testOptionsAndQueryConflict(optionsSchema: JSONSchema, querySchema: JSONSchema): void {
        if (optionsSchema && querySchema) {
            let intersection = _.intersection(Object.keys(optionsSchema.properties || {}), Object.keys(querySchema.properties || {}));
            if (intersection.length > 0) {
                throw serafinError('SerafinRestParamsNameConflict', `Name conflict between options and query (${intersection.toString()})`,
                    { conflict: intersection, optionsSchema: optionsSchema, querySchema: querySchema });
            }
        }
    }
}