/** Shapes of the data the ShipHappens API sends and accepts. */

export interface AuthenticatedUser {
  id: string
  email: string
  displayName: string | null
  mustChangePassword: boolean
}

export interface ApiError {
  error?: string
}
