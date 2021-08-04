const gql = require('graphql-tag')
const { GraphQLError } = require('graphql')
const {
  where,
  and,
  or,
  type,
  author,
  mentions,
  channel,
  key,
  votesFor,
  contact,
  about,
  hasRoot,
  hasFork,
  hasBranch,
  isRoot,
  isPrivate,
  isPublic,
  toPromise,
  toPullStream
} = require('ssb-db2/operators')
const debug = require('debug')('plugins:jitdb-query')

const pkg = require('./package.json')

const typeDefs = gql`
  type Query {
    """
    get user's posts by user id
    """
    userPosts(id: ID): [JSONObject]
    """
    get user's posts with ssb.db(query(where ...operators))
    """
    queryMessages(where: Operator): [JSONObject]
  }

  enum operator {
    type
    author
    mentions
  }

  input Operator {
    and: [Operator]
    or: [Operator]
    operator: operator
    value: JSON
  }
`

module.exports = {
  name: 'jitdbQuery',
  version: pkg.version,
  manifest: {
    userPosts: 'source'
  },
  init(rpc) {
    debug(`[${pkg.name} v${pkg.version}] init`)
    const isDb2 = (() => rpc.db !== undefined)()

    if (!isDb2) throw new GraphQLError(`[${pkg.name} v${pkg.version}] is only valid for ssb-db2 databases`)

    function getUserPosts(id) {
      return rpc.db.query(where(and(type('post'), author(id))))
    }

    function walk(andOr) {
      const queryAnd = andOr.and
      const queryOr = andOr.or

      if (Array.isArray(queryAnd)) {
        for (let [index, val] of queryAnd.entries()) {
          queryAnd[index] = walk(val)
        }
        andOr.and = and(...queryAnd)
      } else if (Array.isArray(queryOr)) {
        for (let [index, val] of queryOr.entries()) {
          queryOr[index] = walk(val)
        }
        andOr.or = or(...queryOr)
      } else {
        const { operator } = andOr

        if (operator) {
          switch (operator) {
            case 'type':
              andOr = type(andOr.value)
              break
            case 'author':
              andOr = author(andOr.value)
              break
            case 'mentions':
              andOr = mentions(andOr.value)
              break

            default:
              console.warn('Missing operator:', operator)
              break
          }
          return andOr
        }
      }
      if (andOr.and) return andOr.and
      if (andOr.or) return andOr.or
    }

    function walkQuery(args) {
      const queryWhere = walk(args.where)
      // console.log(pretty(queryWhere))
      return toPromise()(rpc.db.query(where(queryWhere)))
    }

    const resolvers = {
      Query: {
        userPosts(_parent, { id = rpc.id }) {
          return toPromise()(getUserPosts(id))
        },
        queryMessages(_parent, args, _context, _info) {
          return walkQuery(args)
        }
      }
    }

    rpc.graphql.addTypeDefs(typeDefs)
    rpc.graphql.addResolvers(resolvers)

    return {
      userPosts: (id = rpc.id) => toPullStream()(getUserPosts(id))
    }
  }
}

function pretty(value) {
  return JSON.stringify(value, null, 2)
}
