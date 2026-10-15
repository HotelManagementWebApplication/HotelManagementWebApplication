package com.hospitality.mis.controller.identity;

import com.hospitality.mis.dto.identity.PersonnelDtos.*;
import com.hospitality.mis.service.identity.PersonnelService;
import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import java.util.*;

@RestController
@RequestMapping("/api/hr/personnel")
@PreAuthorize("hasAnyRole('HR','MANAGER','DIRECTOR','ADMIN')")
public class PersonnelController {
    private final PersonnelService service;
    public PersonnelController(PersonnelService service){this.service=service;}
    @GetMapping("/profiles") public List<Profile> profiles(){return service.profiles();}
    @GetMapping("/profiles/{id}") public Profile profile(@PathVariable String id){return service.profile(id);}
    @PutMapping("/profiles/{id}") @PreAuthorize("hasRole('HR')")
    public Profile update(@PathVariable String id,@Valid @RequestBody ProfileUpdate request,@RequestHeader("Idempotency-Key") String key){return service.updateProfile(id,request,key);}
    @GetMapping("/onboarding") public List<Onboarding> requests(){return service.requests();}
    @PutMapping("/onboarding/{id}") @PreAuthorize("hasRole('HR')")
    public Onboarding save(@PathVariable UUID id,@Valid @RequestBody Draft request,@RequestHeader("Idempotency-Key") String key){return service.save(id,request,key);}
    @PostMapping("/onboarding/{id}/submit") @PreAuthorize("hasRole('HR')")
    public Onboarding submit(@PathVariable UUID id,@Valid @RequestBody Submit request,@RequestHeader("Idempotency-Key") String key){return service.submit(id,request,key);}
    @PostMapping("/onboarding/{id}/review") @PreAuthorize("hasAnyRole('MANAGER','DIRECTOR')")
    public ReviewResult review(@PathVariable UUID id,@Valid @RequestBody Review request,@RequestHeader("Idempotency-Key") String key){return service.review(id,request,key);}
}
