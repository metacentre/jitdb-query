const gql = require('graphql-tag')
const { GraphQLError } = require('graphql')
const { where, and, type, author, toPromise, toPullStream } = require('ssb-db2/operators')
const debug = require('debug')('plugins:jitdb-query')

const pkg = require('./package.json')

// module.exports = Object.assign({}, jitdbOperators, {
//   type,
//   author,
//   channel,
//   key,
//   votesFor,
//   contact,
//   mentions,
//   about,
//   hasRoot,
//   hasFork,
//   hasBranch,
//   isRoot,
//   isPrivate,
//   isPublic
// })

const typeDefs = gql`
  type Query {
    """
    get user's posts by user id
    """
    userPosts(id: ID): [JSONObject]
    """
    get user's posts with ssb.db(query(where ...operators))
    """
    queryPosts(where: [PostFilter]): [JSONObject]
  }

  input PostFilter {
    and: [Operator]
  }

  input Operator {
    and: [Operator]
    # or: [Operator]
    operator: String
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

    function pretty(value) {
      return JSON.stringify(value, null, 2)
    }

    const queryPostsArgsExample = {
      where: [
        {
          and: [
            {
              operator: 'author',
              value: {
                id: '@6CAxOI3f+LUOVrbAl0IemqiS7ATpQvr9Mdw9LC4+Uv0=.ed25519'
              }
            }
          ]
        }
      ]
    }

    function buildQueryPosts(args) {
      let q

      const queryWhere = args.where
      queryWhere.forEach(predicate => {
        const queryAnd = predicate.and
        // const queryOr = predicate.or
        if (queryAnd) {
          queryAnd.forEach(queryOperator => {
            const { operator } = queryOperator
            // prettier-ignore
            if (operator === 'author') q = rpc.db.query(
                  where(
                    and(
                      type('post'),
                      author(queryOperator.value)
                    )
                  ),
                  toPromise()
                )
          })
        }
      })

      return q
    }

    const resolvers = {
      Query: {
        userPosts(_parent, { id = rpc.id }) {
          return toPromise()(getUserPosts(id))
        },
        queryPosts(_parent, args, _context, _info) {
          return buildQueryPosts(args)
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
