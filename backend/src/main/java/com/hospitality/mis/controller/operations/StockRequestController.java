package com.hospitality.mis.controller.operations;

import com.hospitality.mis.dto.operations.StockRequestDtos;
import com.hospitality.mis.dto.billing.ServiceDtos;
import com.hospitality.mis.service.operations.StockRequestService;
import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/operations/stock-requests")
public class StockRequestController {
    private final StockRequestService service;
    public StockRequestController(StockRequestService service){this.service=service;}
    @GetMapping @PreAuthorize("hasAnyRole('HOUSEKEEPING','KITCHEN')")
    public List<StockRequestDtos.Response> list(){return service.list();}
    @GetMapping("/catalog") @PreAuthorize("hasAnyRole('HOUSEKEEPING','KITCHEN')")
    public List<ServiceDtos.Response> catalog(){return service.catalog();}
    @PostMapping @PreAuthorize("hasRole('HOUSEKEEPING')")
    public StockRequestDtos.Response create(@Valid @RequestBody StockRequestDtos.CreateRequest request,@RequestHeader("Idempotency-Key") String key){return service.create(request,key);}
    @PostMapping("/{id}/approve") @PreAuthorize("hasRole('KITCHEN')")
    public StockRequestDtos.Response approve(@PathVariable long id,@Valid @RequestBody StockRequestDtos.DecisionRequest request){return service.decide(id,true,request.reason());}
    @PostMapping("/{id}/reject") @PreAuthorize("hasRole('KITCHEN')")
    public StockRequestDtos.Response reject(@PathVariable long id,@Valid @RequestBody StockRequestDtos.DecisionRequest request){return service.decide(id,false,request.reason());}
}
