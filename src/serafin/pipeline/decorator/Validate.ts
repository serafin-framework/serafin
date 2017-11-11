import * as Djv from 'djv'
import * as util from 'util';
import { PipelineAbstract } from '../Abstract'

/**
 * Method decorator enabling JSONSchema validation upon a CRUD method
 */
export function validate(target: any, propertyKey?: string, descriptor?: PropertyDescriptor) {
    let validationFunctions = {
        create: function (params: any[]): void {
            let [resources, options] = params;
            return validateSchema.call(this, '#/definitions/methods/create', { resources: resources, options: options });
        },
        read: function (params: any[]): void {
            let [query, options] = params;
            return validateSchema.call(this, '#/definitions/methods/read', { query: query, options: options });
        },
        update: function (params: any[]): void {
            let [id, values, options] = params;
            return validateSchema.call(this, '#/definitions/methods/update', { id: id, values: values, options: options });
        },
        patch: function (params: any[]): void {
            let [query, values, options] = params;
            return validateSchema.call(this, '#/definitions/methods/patch', { query: query, values: values, options: options });
        },
        delete: function (params: any[]): void {
            let [query, options] = params;
            return validateSchema.call(this, '#/definitions/methods/delete', { query: query, options: options });
        }
    }

    if (typeof descriptor.value == 'function' && PipelineAbstract.getCRUDMethods().find((key) => propertyKey == key)) {
        let func: Function = descriptor.value;

        descriptor.value = function (...params) {
            try {
                validationFunctions[propertyKey].call(this, params);
                return func.apply(this, params);
            } catch (e) {
                let callError = new Error("Validation error in " + Object.getPrototypeOf(this).constructor.name + "." + propertyKey + " : " + e);
                console.log("Validation error in " + Object.getPrototypeOf(this).constructor.name + "." + propertyKey + " : " + e);
                //return Promise.reject(e);
            }

        };
    }
}

function validateSchema(schemaPath: string, params: Object): void {
    const env = new Djv({ version: 'draft-04' });
    env.addSchema('', this.schema());
    let errorMessage = env.validate(schemaPath, params)
    if (errorMessage) {
        throw new Error("Validation failed -> " + errorMessage + ", params: " + (util.inspect(params, false, null)));
    }
}