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
  toPullStream,
  paginate
} = require('ssb-db2/operators')
const debug = require('debug')('plugins:jitdb-query')
const pull = require('pull-stream')

const pkg = require('./package.json')

const typeDefs = gql`
  type Query {
    """
    get user's posts by user id
    """
    userPosts(id: ID): [JSONObject]
    """
    get messages using ssb.db(query(where ...operators))
    for example; get all private posts by author id
      queryMessages(
        where: {
          and: [
            { operator: type, value: "post" }
            { operator: author, value: "@xyzlakjdsskdfjuaypoibmsdbcsdfj=.ed25519" }
            { operator: isPrivate }
          ]
        }
      )
    """
    queryMessages(where: Operator!, paginate: Int): [JSONObject]
  }

  enum operator {
    type
    author
    mentions
    channel
    key
    votesFor
    contact
    about
    hasRoot
    hasFork
    hasBranch
    isRoot
    isPrivate
    isPublic
    fullMentions
    slowEqual
    lt
    lte
    gt
    gte
  }

  input Operator {
    and: [Operator]
    or: [Operator]
    operator: operator
    value: JSON
    values: [JSON]
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

    const { fullMentions, slowEqual, lt, lte, gt, gte } = rpc.db.operators
    debug(rpc.db.operators)

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
            case 'channel':
              andOr = channel(andOr.value)
              break
            case 'key':
              andOr = key(andOr.value)
              break
            case 'votesFor':
              andOr = votesFor(andOr.value)
              break
            case 'contact':
              andOr = contact(andOr.value)
              break
            case 'about':
              andOr = about(andOr.value)
              break
            case 'hasRoot':
              andOr = hasRoot(andOr.value)
              break
            case 'hasFork':
              andOr = hasFork(andOr.value)
              break
            case 'hasBranch':
              andOr = hasBranch(andOr.value)
              break
            case 'isRoot':
              andOr = isRoot(andOr.value)
              break
            case 'isPrivate':
              andOr = isPrivate(andOr.value)
              break
            case 'isPublic':
              andOr = isPublic(andOr.value)
              break
            case 'fullMentions':
              andOr = fullMentions(andOr.value)
              break
            case 'slowEqual':
              andOr = slowEqual(...andOr.values)
              break
            case 'lt':
              andOr = lt(andOr.value, 'timestamp')
              break
            case 'lte':
              andOr = lte(andOr.value, 'timestamp')
              break
            case 'gt':
              andOr = gt(andOr.value, 'timestamp')
              break
            case 'gte':
              andOr = gte(andOr.value, 'timestamp')
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
      const predicates = walk(args.where)
      // console.log(pretty(predicates))
      if (args.paginate) {
        return new Promise((resolve, reject) => {
          // prettier-ignore
          const result =rpc.db.query(
            where(predicates),
            paginate(args.paginate),
            toPullStream()
          )

          pull(
            result,
            pull.drain(
              data => resolve(data),
              error => {
                if (error) reject(error)
              }
            )
          )
        })
      } else return toPromise()(rpc.db.query(where(predicates)))
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

    rpc.graphql.addTypeDefs(typeDefs, pkg.name, pkg.version)
    rpc.graphql.addResolvers(resolvers)

    return {
      userPosts: (id = rpc.id) => toPullStream()(getUserPosts(id))
    }
  }
}

function pretty(value) {
  return JSON.stringify(value, null, 2)
}
