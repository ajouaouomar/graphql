import Entity from '@oudyworks/entity/MongoDB'
import extender from './extender'
import Case from 'case'
import {withFilter} from "graphql-subscriptions/dist/index";

const   GraphQLEntity = extender(Entity)

class MongoDBEntity extends GraphQLEntity {
    bind(state, trackChange = true, bindObject = {}) {
        if(state._id) {
            state.id = state._id
            delete state._id
        }
        return super.bind(state, trackChange, bindObject)
    }
}


MongoDBEntity[MongoDBEntity.query] = function(resolve, options = {args: {}}) {
    if(!resolve)
        resolve = (source, args, context, info) => {
            return this.load(args.id, context)
        }
    let query = GraphQLEntity[MongoDBEntity.query].bind(this)(resolve, options)
    return query
}

MongoDBEntity[MongoDBEntity.listQuery] = function(resolve, options = {fields: {}, args: {}}) {
    if(!resolve)
        resolve = (source, args, context, info) => {
            return this.loadAll(args, context)
        }
    let query = GraphQLEntity[MongoDBEntity.listQuery].bind(this)(resolve, options)
    return query
}

MongoDBEntity[MongoDBEntity.mutation] = function(resolve, options = {fields: {}, args: {}, errorFields: {}}) {
    if(!resolve) {
        let name = Case.camel(this.name)
        resolve = (source, args, context, info) => {
            return this.load(args.id, context).then(
                object =>
                    object.bind(args[name]).then(
                        bind => {
                            if(bind.erred)
                                return Promise.resolve(bind)
                            else
                                return object.save().then(
                                    () =>
                                        Promise.resolve(bind)
                                )
                        }
                    ).then(
                        bind => {
                            if(bind.changed) {
                                this.clear(args.id)
                                GraphQLEntity.pubsub.publish(
                                    name,
                                    {
                                        [name]: object
                                    }
                                )
                            }
                            return {
                                [name]: object,
                                ...bind
                            }
                        }
                    )
            )
        }
    }
    let query = GraphQLEntity[MongoDBEntity.mutation].bind(this)(resolve, options)
    return query
}

MongoDBEntity[MongoDBEntity.subscription] = function(subscribe, options = {args: {}, resolve: undefined}) {
    if(!subscribe)
        // subscribe = (source, args, context, info) => {
        subscribe = withFilter(
            () =>
                GraphQLEntity.pubsub.asyncIterator(Case.camel(this.name)),
            (source, args, context, info) => {
                if(source) {
                    if(args.id)
                        return args.id == `${source[Case.camel(this.name)].id}`
                    return true
                }
                return false
            }
        )
    let query = GraphQLEntity[MongoDBEntity.subscription].bind(this)(subscribe, options)
    return query
}



export default MongoDBEntity