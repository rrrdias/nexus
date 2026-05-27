class JwtToken
  SECRET = ENV.fetch("JWT_SECRET", "nexus-secret-key-2026")

  def self.encode(user)
    payload = {
      sub: user.id,
      email: user.email,
      isSuperAdmin: user.super_admin?,
      isDisabled: user.disabled?,
      exp: 24.hours.from_now.to_i
    }
    JWT.encode(payload, SECRET, "HS256")
  end

  def self.decode(token)
    JWT.decode(token, SECRET, true, algorithm: "HS256").first
  end
end
