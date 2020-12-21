/**
 * A data structure providing "inclusive-or" as opposed to `Either`'s "exclusive-or".
 *
 * If you interpret `Either<E, A>` as suggesting the computation may either fail or succeed (exclusively), then
 * `These<E, A>` may fail, succeed, or do both at the same time.
 *
 * There are a few ways to interpret the both case:
 *
 * - You can think of a computation that has a non-fatal error.
 * - You can think of a computation that went as far as it could before erroring.
 * - You can think of a computation that keeps track of errors as it completes.
 *
 * Another way you can think of `These<E, A>` is saying that we want to handle `E` kind of data, `A` kind of data, or
 * both `E` and `A` kind of data at the same time. This is particularly useful when it comes to displaying UI's.
 *
 * (description adapted from https://package.elm-lang.org/packages/joneshf/elm-these)
 *
 * Adapted from https://github.com/purescript-contrib/purescript-these
 *
 * @since 3.0.0
 */
import { Applicative, Applicative2C } from './Applicative'
import { Bifunctor2 } from './Bifunctor'
import { Either, Left, Right } from './Either'
import { Eq, fromEquals } from './Eq'
import { Foldable2 } from './Foldable'
import { FromEither2, fromOption_, fromPredicate_ } from './FromEither'
import { identity, Lazy, pipe, Predicate, Refinement } from './function'
import { Functor2 } from './Functor'
import { HKT } from './HKT'
import { Monad2C } from './Monad'
import { isNone, none, Option, some } from './Option'
import { Pointed2 } from './Pointed'
import { Semigroup } from './Semigroup'
import { Show } from './Show'
import { Traversable2 } from './Traversable'

// -------------------------------------------------------------------------------------
// model
// -------------------------------------------------------------------------------------

/**
 * @category model
 * @since 3.0.0
 */
export interface Both<E, A> {
  readonly _tag: 'Both'
  readonly left: E
  readonly right: A
}

/**
 * @category model
 * @since 3.0.0
 */
export type These<E, A> = Either<E, A> | Both<E, A>

/**
 * @category constructors
 * @since 3.0.0
 */
export function left<E, A = never>(left: E): These<E, A> {
  return { _tag: 'Left', left }
}

/**
 * @category constructors
 * @since 3.0.0
 */
export function right<A, E = never>(right: A): These<E, A> {
  return { _tag: 'Right', right }
}

/**
 * @category constructors
 * @since 3.0.0
 */
export function both<E, A>(left: E, right: A): These<E, A> {
  return { _tag: 'Both', left, right }
}

/**
 * @category destructors
 * @since 3.0.0
 */
export const fold = <E, B, A>(onLeft: (e: E) => B, onRight: (a: A) => B, onBoth: (e: E, a: A) => B) => (
  fa: These<E, A>
): B => {
  switch (fa._tag) {
    case 'Left':
      return onLeft(fa.left)
    case 'Right':
      return onRight(fa.right)
    case 'Both':
      return onBoth(fa.left, fa.right)
  }
}

/**
 * @category combinators
 * @since 3.0.0
 */
export const swap: <E, A>(fa: These<E, A>) => These<A, E> = fold(right, left, (e, a) => both(a, e))

/**
 * @example
 * import { toTuple, left, right, both } from 'fp-ts/These'
 *
 * const f = toTuple(() => 'a', () => 1)
 * assert.deepStrictEqual(f(left('b')), ['b', 1])
 * assert.deepStrictEqual(f(right(2)), ['a', 2])
 * assert.deepStrictEqual(f(both('b', 2)), ['b', 2])
 *
 * @category destructors
 * @since 3.0.0
 */
export function toTuple<E, A>(e: Lazy<E>, a: Lazy<A>): (fa: These<E, A>) => readonly [E, A] {
  return (fa) => (isLeft(fa) ? [fa.left, a()] : isRight(fa) ? [e(), fa.right] : [fa.left, fa.right])
}

/**
 * Returns an `E` value if possible
 *
 * @example
 * import { getLeft, left, right, both } from 'fp-ts/These'
 * import { none, some } from 'fp-ts/Option'
 *
 * assert.deepStrictEqual(getLeft(left('a')), some('a'))
 * assert.deepStrictEqual(getLeft(right(1)), none)
 * assert.deepStrictEqual(getLeft(both('a', 1)), some('a'))
 *
 * @category destructors
 * @since 3.0.0
 */
export function getLeft<E, A>(fa: These<E, A>): Option<E> {
  return isLeft(fa) ? some(fa.left) : isRight(fa) ? none : some(fa.left)
}

/**
 * Returns an `A` value if possible
 *
 * @example
 * import { getRight, left, right, both } from 'fp-ts/These'
 * import { none, some } from 'fp-ts/Option'
 *
 * assert.deepStrictEqual(getRight(left('a')), none)
 * assert.deepStrictEqual(getRight(right(1)), some(1))
 * assert.deepStrictEqual(getRight(both('a', 1)), some(1))
 *
 * @category destructors
 * @since 3.0.0
 */
export function getRight<E, A>(fa: These<E, A>): Option<A> {
  return isLeft(fa) ? none : isRight(fa) ? some(fa.right) : some(fa.right)
}

/**
 * Returns `true` if the these is an instance of `Left`, `false` otherwise
 *
 * @category guards
 * @since 3.0.0
 */
export function isLeft<E, A>(fa: These<E, A>): fa is Left<E> {
  return fa._tag === 'Left'
}

/**
 * Returns `true` if the these is an instance of `Right`, `false` otherwise
 *
 * @category guards
 * @since 3.0.0
 */
export function isRight<E, A>(fa: These<E, A>): fa is Right<A> {
  return fa._tag === 'Right'
}

/**
 * Returns `true` if the these is an instance of `Both`, `false` otherwise
 *
 * @category guards
 * @since 3.0.0
 */
export function isBoth<E, A>(fa: These<E, A>): fa is Both<E, A> {
  return fa._tag === 'Both'
}

/**
 * @example
 * import { leftOrBoth, left, both } from 'fp-ts/These'
 * import { none, some } from 'fp-ts/Option'
 *
 * assert.deepStrictEqual(leftOrBoth(() => 'a')(none), left('a'))
 * assert.deepStrictEqual(leftOrBoth(() => 'a')(some(1)), both('a', 1))
 *
 * @category constructors
 * @since 3.0.0
 */
export function leftOrBoth<E>(e: Lazy<E>): <A>(ma: Option<A>) => These<E, A> {
  return (ma) => (isNone(ma) ? left(e()) : both(e(), ma.value))
}

/**
 * @example
 * import { rightOrBoth, right, both } from 'fp-ts/These'
 * import { none, some } from 'fp-ts/Option'
 *
 * assert.deepStrictEqual(rightOrBoth(() => 1)(none), right(1))
 * assert.deepStrictEqual(rightOrBoth(() => 1)(some('a')), both('a', 1))
 *
 * @category constructors
 * @since 3.0.0
 */
export function rightOrBoth<A>(a: Lazy<A>): <E>(me: Option<E>) => These<E, A> {
  return (me) => (isNone(me) ? right(a()) : both(me.value, a()))
}

/**
 * Returns the `E` value if and only if the value is constructed with `Left`
 *
 * @example
 * import { getLeftOnly, left, right, both } from 'fp-ts/These'
 * import { none, some } from 'fp-ts/Option'
 *
 * assert.deepStrictEqual(getLeftOnly(left('a')), some('a'))
 * assert.deepStrictEqual(getLeftOnly(right(1)), none)
 * assert.deepStrictEqual(getLeftOnly(both('a', 1)), none)
 *
 * @category destructors
 * @since 3.0.0
 */
export function getLeftOnly<E, A>(fa: These<E, A>): Option<E> {
  return isLeft(fa) ? some(fa.left) : none
}

/**
 * Returns the `A` value if and only if the value is constructed with `Right`
 *
 * @example
 * import { getRightOnly, left, right, both } from 'fp-ts/These'
 * import { none, some } from 'fp-ts/Option'
 *
 * assert.deepStrictEqual(getRightOnly(left('a')), none)
 * assert.deepStrictEqual(getRightOnly(right(1)), some(1))
 * assert.deepStrictEqual(getRightOnly(both('a', 1)), none)
 *
 * @category destructors
 * @since 3.0.0
 */
export function getRightOnly<E, A>(fa: These<E, A>): Option<A> {
  return isRight(fa) ? some(fa.right) : none
}

/**
 * Takes a pair of `Option`s and attempts to create a `These` from them
 *
 * @example
 * import { fromOptions, left, right, both } from 'fp-ts/These'
 * import { none, some } from 'fp-ts/Option'
 *
 * assert.deepStrictEqual(fromOptions(none, none), none)
 * assert.deepStrictEqual(fromOptions(some('a'), none), some(left('a')))
 * assert.deepStrictEqual(fromOptions(none, some(1)), some(right(1)))
 * assert.deepStrictEqual(fromOptions(some('a'), some(1)), some(both('a', 1)))
 *
 * @category constructors
 * @since 3.0.0
 */
export function fromOptions<E, A>(fe: Option<E>, fa: Option<A>): Option<These<E, A>> {
  return isNone(fe)
    ? isNone(fa)
      ? none
      : some(right(fa.value))
    : isNone(fa)
    ? some(left(fe.value))
    : some(both(fe.value, fa.value))
}

/**
 * Map a pair of functions over the two type arguments of the bifunctor.
 *
 * @category Bifunctor
 * @since 3.0.0
 */
export const bimap: Bifunctor2<URI>['bimap'] = (f, g) => (fa) =>
  isLeft(fa) ? left(f(fa.left)) : isRight(fa) ? right(g(fa.right)) : both(f(fa.left), g(fa.right))

/**
 * Map a function over the first type argument of a bifunctor.
 *
 * @category Bifunctor
 * @since 3.0.0
 */
export const mapLeft: Bifunctor2<URI>['mapLeft'] = (f) => (fa) =>
  isLeft(fa) ? left(f(fa.left)) : isBoth(fa) ? both(f(fa.left), fa.right) : fa

/**
 * `map` can be used to turn functions `(a: A) => B` into functions `(fa: F<A>) => F<B>` whose argument and return types
 * use the type constructor `F` to represent some computational context.
 *
 * @category Functor
 * @since 3.0.0
 */
export const map: Functor2<URI>['map'] = (f) => (fa) =>
  isLeft(fa) ? fa : isRight(fa) ? right(f(fa.right)) : both(fa.left, f(fa.right))

/**
 * @category Foldable
 * @since 3.0.0
 */
export const reduce: Foldable2<URI>['reduce'] = (b, f) => (fa) =>
  isLeft(fa) ? b : isRight(fa) ? f(b, fa.right) : f(b, fa.right)

/**
 * @category Foldable
 * @since 3.0.0
 */
export const foldMap: Foldable2<URI>['foldMap'] = (M) => (f) => (fa) =>
  isLeft(fa) ? M.empty : isRight(fa) ? f(fa.right) : f(fa.right)

/**
 * @category Foldable
 * @since 3.0.0
 */
export const reduceRight: Foldable2<URI>['reduceRight'] = (b, f) => (fa) =>
  isLeft(fa) ? b : isRight(fa) ? f(fa.right, b) : f(fa.right, b)

/**
 * @since 3.0.0
 */
export const traverse: Traversable2<URI>['traverse'] = <F>(
  F: Applicative<F>
): (<A, B>(f: (a: A) => HKT<F, B>) => <E>(ta: These<E, A>) => HKT<F, These<E, B>>) => (f) => (ta) =>
  isLeft(ta)
    ? F.of(ta)
    : isRight(ta)
    ? pipe(f(ta.right), F.map(right))
    : pipe(
        f(ta.right),
        F.map((b) => both(ta.left, b))
      )

/**
 * @since 3.0.0
 */
export const sequence: Traversable2<URI>['sequence'] = <F>(F: Applicative<F>) => <E, A>(
  ta: These<E, HKT<F, A>>
): HKT<F, These<E, A>> => {
  return isLeft(ta)
    ? F.of(ta)
    : isRight(ta)
    ? pipe(ta.right, F.map(right))
    : pipe(
        ta.right,
        F.map((b) => both(ta.left, b))
      )
}

/**
 * @category Applicative
 * @since 3.0.0
 */
export const of: Pointed2<URI>['of'] = right

// -------------------------------------------------------------------------------------
// instances
// -------------------------------------------------------------------------------------

/**
 * @category instances
 * @since 3.0.0
 */
export const URI = 'These'

/**
 * @category instances
 * @since 3.0.0
 */
export type URI = typeof URI

declare module './HKT' {
  interface URItoKind2<E, A> {
    readonly [URI]: These<E, A>
  }
}

/**
 * @category instances
 * @since 3.0.0
 */
export function getShow<E, A>(SE: Show<E>, SA: Show<A>): Show<These<E, A>> {
  return {
    show: fold(
      (l) => `left(${SE.show(l)})`,
      (a) => `right(${SA.show(a)})`,
      (l, a) => `both(${SE.show(l)}, ${SA.show(a)})`
    )
  }
}

/**
 * @category instances
 * @since 3.0.0
 */
export function getEq<E, A>(EE: Eq<E>, EA: Eq<A>): Eq<These<E, A>> {
  return fromEquals((second) => (first) =>
    isLeft(first)
      ? isLeft(second) && EE.equals(second.left)(first.left)
      : isRight(first)
      ? isRight(second) && EA.equals(second.right)(first.right)
      : isBoth(second) && EE.equals(second.left)(first.left) && EA.equals(second.right)(first.right)
  )
}

/**
 * @category instances
 * @since 3.0.0
 */
export function getSemigroup<E, A>(SE: Semigroup<E>, SA: Semigroup<A>): Semigroup<These<E, A>> {
  return {
    concat: (second) => (first) =>
      isLeft(first)
        ? isLeft(second)
          ? left(SE.concat(second.left)(first.left))
          : isRight(second)
          ? both(first.left, second.right)
          : both(SE.concat(second.left)(first.left), second.right)
        : isRight(first)
        ? isLeft(second)
          ? both(second.left, first.right)
          : isRight(second)
          ? right(SA.concat(second.right)(first.right))
          : both(second.left, SA.concat(second.right)(first.right))
        : isLeft(second)
        ? both(SE.concat(second.left)(first.left), first.right)
        : isRight(second)
        ? both(first.left, SA.concat(second.right)(first.right))
        : both(SE.concat(second.left)(first.left), SA.concat(second.right)(first.right))
  }
}

/**
 * @category instances
 * @since 3.0.0
 */
export const Functor: Functor2<URI> = {
  URI,
  map
}

/**
 * @category instances
 * @since 3.0.0
 */
export const Pointed: Pointed2<URI> = {
  URI,
  map,
  of
}

/**
 * @category instances
 * @since 3.0.0
 */
export function getApplicative<E>(SE: Semigroup<E>): Applicative2C<URI, E> {
  return {
    URI,
    map,
    ap: (fa) => (fab) =>
      isLeft(fab)
        ? isLeft(fa)
          ? left(SE.concat(fa.left)(fab.left))
          : isRight(fa)
          ? left(fab.left)
          : left(SE.concat(fa.left)(fab.left))
        : isRight(fab)
        ? isLeft(fa)
          ? left(fa.left)
          : isRight(fa)
          ? right(fab.right(fa.right))
          : both(fa.left, fab.right(fa.right))
        : isLeft(fa)
        ? left(SE.concat(fa.left)(fab.left))
        : isRight(fa)
        ? both(fab.left, fab.right(fa.right))
        : both(SE.concat(fa.left)(fab.left), fab.right(fa.right)),
    of
  }
}

/**
 * @category instances
 * @since 3.0.0
 */
export function getMonad<E>(SE: Semigroup<E>): Monad2C<URI, E> {
  const chain = <A, B>(f: (a: A) => These<E, B>) => (ma: These<E, A>): These<E, B> => {
    if (isLeft(ma)) {
      return ma
    }
    if (isRight(ma)) {
      return f(ma.right)
    }
    const fb = f(ma.right)
    return isLeft(fb)
      ? left(SE.concat(fb.left)(ma.left))
      : isRight(fb)
      ? both(ma.left, fb.right)
      : both(SE.concat(fb.left)(ma.left), fb.right)
  }

  return {
    URI,
    map,
    of,
    chain
  }
}

/**
 * @category instances
 * @since 3.0.0
 */
export const FromEither: FromEither2<URI> = {
  URI,
  fromEither: identity
}

/**
 * Derivable from `FromEither`.
 *
 * @category constructors
 * @since 3.0.0
 */
export const fromOption: <E>(onNone: Lazy<E>) => <A>(ma: Option<A>) => These<E, A> =
  /*#__PURE__*/
  fromOption_(FromEither)

/**
 * Derivable from `FromEither`.
 *
 * @category constructors
 * @since 3.0.0
 */
export const fromPredicate: {
  <A, B extends A, E>(refinement: Refinement<A, B>, onFalse: (a: A) => E): (a: A) => These<E, B>
  <A, E>(predicate: Predicate<A>, onFalse: (a: A) => E): (a: A) => These<E, A>
} =
  /*#__PURE__*/
  fromPredicate_(FromEither)

/**
 * @category instances
 * @since 3.0.0
 */
export const Bifunctor: Bifunctor2<URI> = {
  URI,
  bimap,
  mapLeft
}

/**
 * @category instances
 * @since 3.0.0
 */
export const Foldable: Foldable2<URI> = {
  URI,
  reduce,
  foldMap,
  reduceRight
}

/**
 * @category instances
 * @since 3.0.0
 */
export const Traversable: Traversable2<URI> = {
  URI,
  map,
  traverse,
  sequence
}
