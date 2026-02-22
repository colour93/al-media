import { t } from 'elysia'
import { ErrorCode } from './error'

export const BaseResponse = t.Object({
  success: t.Boolean(),
  data: t.Optional(t.Any()),
  code: t.Optional(t.Enum(ErrorCode)),
  errors: t.Optional(t.Any()),
  constraint: t.Optional(t.String()),
  status: t.Optional(t.Literal('ok')),
})

export const SuccessResponse = t.Intersect([
  BaseResponse, t.Object({
    data: t.Any()
  })
])

export const ErrorResponse = t.Intersect([
  BaseResponse,
  t.Object({
    success: t.Literal(false),
    message: t.String(),
    code: t.Enum(
      ErrorCode
    ),
  })
])

export const HealthResponse = t.Intersect([
  BaseResponse,
  t.Object({
    status: t.Literal("ok"),
  })
])

export const ValidationErrorResponse = t.Intersect([
  ErrorResponse,
  t.Object({
    code: t.Literal(ErrorCode.VALIDATION),
    errors: t.Optional(
      t.Array(
        t.Object({
          field: t.String(),
          message: t.String(),
        })
      )
    ),
  })
])

export const ForeignKeyViolationErrorResponse = t.Intersect([
  ErrorResponse,
  t.Object({
    code: t.Literal(ErrorCode.FOREIGN_KEY_VIOLATION),
    constraint: t.Optional(t.String()),
  })
])

export const UniqueViolationErrorResponse = t.Intersect([
  ErrorResponse,
  t.Object({
    code: t.Literal(ErrorCode.UNIQUE_VIOLATION),
  })
])