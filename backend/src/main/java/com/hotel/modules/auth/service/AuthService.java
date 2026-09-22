package com.hotel.modules.auth.service;

import com.hotel.modules.auth.dto.AuthResponse;
import com.hotel.modules.auth.dto.LoginRequest;

public interface AuthService {
    AuthResponse login(LoginRequest request);
}
