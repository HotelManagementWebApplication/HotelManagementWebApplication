package com.hospitality.mis.controller.operations;

import com.hospitality.mis.dto.operations.StockReturnDtos;
import com.hospitality.mis.dto.billing.ServiceDtos;
import com.hospitality.mis.service.operations.StockReturnService;
import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/operations/stock-returns")
public class StockReturnController {
    private final StockReturnService service;
    public StockReturnController(StockReturnService service){this.service=service;}
    @GetMapping @PreAuthorize("hasAnyRole('HOUSEKEEPING','KITCHEN')")
    public List<StockReturnDtos.Response> list(){return service.list();}
    @GetMapping("/catalog") @PreAuthorize("hasAnyRole('HOUSEKEEPING','KITCHEN')")
    public List<ServiceDtos.Response> catalog(){return service.catalog();}
    @PostMapping @PreAuthorize("hasRole('HOUSEKEEPING')")
    public StockReturnDtos.Response create(@Valid @RequestBody StockReturnDtos.CreateRequest request,@RequestHeader("Idempotency-Key") String key){return service.create(request,key);}
    @PostMapping("/{id}/approve") @PreAuthorize("hasRole('KITCHEN')")
    public StockReturnDtos.Response approve(@PathVariable long id,@Valid @RequestBody StockReturnDtos.DecisionRequest request){return service.decide(id,true,request.reason());}
    @PostMapping("/{id}/reject") @PreAuthorize("hasRole('KITCHEN')")
    public StockReturnDtos.Response reject(@PathVariable long id,@Valid @RequestBody StockReturnDtos.DecisionRequest request){return service.decide(id,false,request.reason());}
}
